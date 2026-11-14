import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { revalidateCatalog } from "../brands/admin"
import { CatalogItem, loadCatalogItems } from "../catalog/store-catalog"
import { MOYSKLAD_MODULE } from "../../modules/moysklad"
import MoyskladModuleService from "../../modules/moysklad/service"
import { SORT_MODULE } from "../../modules/sort"
import SortModuleService from "../../modules/sort/service"
import { attrValue } from "../moysklad/map-product"
import { MsProduct } from "../moysklad/types"
import { ArrangeConfig, StorePin } from "./arrange"
import { DEFAULT_CONFIG, mergeConfig, SortConfig, validateConfig, Warmth, Zone, ZONES } from "./config"
import { activeProfile, CardInput, CardScore, scoreCards } from "./score"
import { matrixRow, seasonState } from "./season"

/**
 * Умная сортировка: данные и пересчёт (ТЗ, раздел 7). Балл считается ночью и при изменении остатков
 * и хранится в sort_product_score; порядок листинга витрина собирает по запросу из готовых баллов.
 */
const svc = (c: MedusaContainer): SortModuleService => c.resolve(SORT_MODULE)
const DAY = 86_400_000
const NEW_DAYS = 45

// ——— Настройки: версии ———

export type ConfigVersion = { version: number; author: string | null; note: string | null; created_at: string }

export async function activeConfig(container: MedusaContainer): Promise<{ config: SortConfig; version: number }> {
  const [row] = await svc(container).listSortConfigVersions({}, { take: 1, order: { version: "DESC" } })
  return row ? { config: mergeConfig(row.config), version: row.version } : { config: DEFAULT_CONFIG, version: 0 }
}

export async function configVersions(container: MedusaContainer, take = 30): Promise<ConfigVersion[]> {
  const rows = await svc(container).listSortConfigVersions({}, { take, order: { version: "DESC" } })
  return rows.map((r) => ({ version: r.version, author: r.author, note: r.note, created_at: new Date(r.created_at).toISOString() }))
}

/** Сохранить настройки новой версией (откат — тоже новая версия с прежним содержимым) */
export async function saveConfig(container: MedusaContainer, raw: unknown, author: string | null, note: string | null): Promise<{ version: number; config: SortConfig }> {
  const { value, error } = validateConfig(raw)
  if (!value) throw new Error(error)
  const { version } = await activeConfig(container)
  await svc(container).createSortConfigVersions({ version: version + 1, config: value as unknown as Record<string, unknown>, author, note })
  return { version: version + 1, config: value }
}

export async function configByVersion(container: MedusaContainer, version: number): Promise<SortConfig | null> {
  const [row] = await svc(container).listSortConfigVersions({ version }, { take: 1 })
  return row ? mergeConfig(row.config) : null
}

// ——— Ручные правила ———

export type ManualRule = {
  id: string; kind: "pin" | "boost" | "demote" | "drop" | "sale"; target_type: "product" | "brand" | "collection" | "none"
  target: string | null; value: number | null; listing: string | null; position: number | null
  starts_at: string; ends_at: string; author: string | null; note: string | null
}

export async function allRules(container: MedusaContainer): Promise<ManualRule[]> {
  const rows = await svc(container).listSortManualRules({}, { take: 2000, order: { ends_at: "DESC" } })
  return rows.map((r) => ({
    id: r.id, kind: r.kind, target_type: r.target_type, target: r.target, value: r.value, listing: r.listing, position: r.position,
    starts_at: new Date(r.starts_at).toISOString(), ends_at: new Date(r.ends_at).toISOString(), author: r.author, note: r.note,
  }))
}

export const isActive = (r: Pick<ManualRule, "starts_at" | "ends_at">, now: Date) => Date.parse(r.starts_at) <= now.getTime() && now.getTime() < Date.parse(r.ends_at)

// ——— События листингов ———

export type ListingEvent = { t: "i" | "c" | "a" | "v"; p?: string; l: string; pos?: number }

/** День по Москве, ГГГГ-ММ-ДД */
export const mskDay = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10)

const okId = (s: unknown): s is string => typeof s === "string" && /^[\w-]{1,64}$/.test(s)
const okListing = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9:/_-]{1,120}$/.test(s)

/** Записать пачку событий с сайта: показ (i), клик (c), корзина (a), визит листинга (v). Агрегируются по дням */
export async function recordEvents(container: MedusaContainer, events: ListingEvent[], now = new Date()): Promise<number> {
  const agg = new Map<string, { p: string; l: string; i: number; c: number; a: number; it: number; ct: number }>()
  for (const e of events.slice(0, 300)) {
    if (!okListing(e.l)) continue
    const p = e.t === "v" ? "*" : e.p
    if (p !== "*" && !okId(p)) continue
    const key = `${p}|${e.l}`
    const row = agg.get(key) ?? { p: p!, l: e.l, i: 0, c: 0, a: 0, it: 0, ct: 0 }
    const top = typeof e.pos === "number" && e.pos >= 1 && e.pos <= 24
    if (e.t === "i" || e.t === "v") { row.i++; if (top && e.t === "i") row.it++ }
    else if (e.t === "c") { row.c++; if (top) row.ct++ }
    else if (e.t === "a") row.a++
    else continue
    agg.set(key, row)
  }
  if (!agg.size) return 0
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const day = mskDay(now)
  for (const r of agg.values()) {
    await pg.raw(
      `insert into sort_listing_event (id, day, product_id, listing, impressions, clicks, carts, impressions_top, clicks_top)
       values ('sle_' || md5(random()::text || clock_timestamp()::text), ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (day, product_id, listing) do update set impressions = sort_listing_event.impressions + excluded.impressions,
         clicks = sort_listing_event.clicks + excluded.clicks, carts = sort_listing_event.carts + excluded.carts,
         impressions_top = sort_listing_event.impressions_top + excluded.impressions_top, clicks_top = sort_listing_event.clicks_top + excluded.clicks_top,
         updated_at = now()`,
      [day, r.p, r.l, r.i, r.c, r.a, r.it, r.ct]
    )
  }
  return agg.size
}

export type EventSums = { byProduct: Map<string, { i: number; c: number; a: number }>; days: number }

/** Показы, клики и корзины по карточкам за 30 дней и сколько дней уже собирается статистика */
export async function eventSums(container: MedusaContainer, now = new Date(), days = 30): Promise<EventSums> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const since = mskDay(new Date(now.getTime() - days * DAY))
  const rows = (await pg.raw(
    `select product_id, sum(impressions)::int as i, sum(clicks)::int as c, sum(carts)::int as a from sort_listing_event
     where day > ? and product_id <> '*' and deleted_at is null group by product_id`, [since]
  )).rows as { product_id: string; i: number; c: number; a: number }[]
  const first = (await pg.raw(`select min(day) as d from sort_listing_event where deleted_at is null`)).rows[0]?.d as string | null
  return {
    byProduct: new Map(rows.map((r) => [r.product_id, { i: r.i, c: r.c, a: r.a }])),
    days: first ? Math.floor((Date.parse(mskDay(now)) - Date.parse(first)) / DAY) + 1 : 0,
  }
}

// ——— Данные из МоегоСклада: закупка и коллекция ———

const collectionAttr = () => process.env.MOYSKLAD_ATTR_COLLECTION?.trim() || "Коллекция"

/** Закупочные цены и коллекции из МС (раз в сутки перед пересчётом). МС недоступен — остаются прежние */
export async function refreshCardData(container: MedusaContainer): Promise<{ products: number; with_cost: number; with_collection: number } | null> {
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  if (!ms.api.isConfigured()) return null
  const all = await ms.api.listAll<MsProduct>("entity/product")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "external_id"], pagination: { take: 100000 } })
  const byExternal = new Map((data as { id: string; external_id?: string | null }[]).filter((p) => p.external_id).map((p) => [p.external_id!, p.id]))
  const existing = new Map((await svc(container).listSortCardCosts({}, { take: 100000 })).map((r) => [r.product_id, r]))
  const create: { product_id: string; cost_price: number | null; collection: string | null }[] = []
  const update: { id: string; cost_price: number | null; collection: string | null }[] = []
  let cost = 0, coll = 0
  for (const p of all) {
    const id = byExternal.get(p.id)
    if (!id) continue
    const row = {
      cost_price: p.buyPrice?.value ? Math.round(p.buyPrice.value) / 100 : null,
      collection: attrValue(p.attributes?.find((a) => a.name === collectionAttr())?.value),
    }
    if (row.cost_price) cost++
    if (row.collection) coll++
    const ex = existing.get(id)
    if (!ex) create.push({ product_id: id, ...row })
    else if (ex.cost_price !== row.cost_price || ex.collection !== row.collection) update.push({ id: ex.id, ...row })
  }
  if (create.length) await svc(container).createSortCardCosts(create)
  if (update.length) await svc(container).updateSortCardCosts(update)
  return { products: all.length, with_cost: cost, with_collection: coll }
}

// ——— Карточки для расчёта ———

const SIZE_GROUP: Record<string, string> = {
  kurtki: "top", "svitery-i-kardigany": "top", "hudi-i-svitshoty": "top", "futbolki-i-longslivy": "top", "rubashki-i-polo": "top",
  dzhinsy: "bottom", bryuki: "bottom", shorty: "bottom", obuv: "shoes",
}

export type CardExtra = { cost: Map<string, number | null>; collection: Map<string, string | null> }

export async function cardExtra(container: MedusaContainer): Promise<CardExtra> {
  const rows = await svc(container).listSortCardCosts({}, { take: 100000 })
  return { cost: new Map(rows.map((r) => [r.product_id, r.cost_price])), collection: new Map(rows.map((r) => [r.product_id, r.collection])) }
}

/** Карточки каталога в виде входа для расчёта балла; ручные бусты и понижения уже перемножены */
export function buildCards(items: CatalogItem[], extra: CardExtra, events: EventSums, rules: ManualRule[], now: Date): CardInput[] {
  const orders = new Map<string, number>()
  for (const i of items) orders.set(i.model ?? i.id, (orders.get(i.model ?? i.id) ?? 0) + (i.sales_units ?? 0))
  const mult = rules.filter((r) => (r.kind === "boost" || r.kind === "demote") && isActive(r, now) && r.value && r.target)
  return items.map((i) => {
    const collection = extra.collection.get(i.id) ?? null
    const notes: string[] = []
    let manual = 1
    for (const r of mult) {
      const hit = r.target_type === "product" ? r.target === i.id
        : r.target_type === "brand" ? r.target === i.brand?.handle
        : r.target_type === "collection" ? Boolean(collection) && collection!.toUpperCase().replace(/\s/g, "") === r.target!.toUpperCase().replace(/\s/g, "")
        : false
      if (!hit) continue
      manual *= r.value!
      notes.push(`${r.kind === "boost" ? "буст" : "понижение"} ${r.target_type === "product" ? "товара" : r.target_type === "brand" ? "бренда" : "коллекции"} ×${r.value}`)
    }
    // Флажок «Закрепить» в карточке товара — постоянный буст (закрепление на позиции — в ручных правилах)
    if (i.pinned) { manual *= 1.5; notes.push("флажок «Закрепить» ×1.5") }
    const ev = events.byProduct.get(i.id)
    return {
      id: i.id, category: i.category?.handle ?? null, brand: i.brand?.handle ?? null,
      row: matrixRow(i.category?.handle ?? null, i.title), warmth: (i.warmth as Warmth | null) ?? null, collection,
      // Стартовый ассортимент пришёл одной загрузкой: дата приёмки неизвестна — новизны нет. Флажок «Новинка» — как только что принятый
      age_days: i.new_manual ? 0 : i.initial_import ? null : Math.max(0, (now.getTime() - Date.parse(i.created_at)) / DAY),
      orders_30d: orders.get(i.model ?? i.id) ?? 0,
      impressions_30d: ev?.i ?? 0, clicks_30d: ev?.c ?? 0, carts_30d: ev?.a ?? 0,
      sizes: i.sizes.map((s) => s.size), sizes_in_stock: i.sizes.filter((s) => s.in_stock).map((s) => s.size),
      size_group: SIZE_GROUP[i.category?.handle ?? ""] ?? "none",
      stock_units: i.stock_units ?? 0, price: i.price, compare_at: i.compare_at, cost: extra.cost.get(i.id) ?? null,
      preorder: i.preorder, in_stock: i.in_stock, photos: i.images_count, manual, manual_notes: notes,
    }
  })
}

// ——— Пересчёт ———

export type SortState = { last_run_at: string | null; last_ok_at: string | null; error: string | null; cards: number; written: number; ms: number; profile: string | null; config_version: number; scores_version: string | null }

async function store(container: MedusaContainer) {
  const stores = (await container.resolve(Modules.STORE).listStores({}, { take: 1 })) as { id: string; metadata?: Record<string, unknown> | null }[]
  if (!stores[0]) throw new Error("Магазин не найден")
  return stores[0]
}

export async function sortState(container: MedusaContainer): Promise<SortState> {
  const raw = ((await store(container)).metadata?.sort_state ?? {}) as Partial<SortState>
  return { last_run_at: null, last_ok_at: null, error: null, cards: 0, written: 0, ms: 0, profile: null, config_version: 0, scores_version: null, ...raw }
}

async function saveState(container: MedusaContainer, patch: Partial<SortState>) {
  const s = await store(container)
  const cur = (s.metadata?.sort_state ?? {}) as Partial<SortState>
  await container.resolve(Modules.STORE).updateStores(s.id, { metadata: { ...(s.metadata ?? {}), sort_state: { ...cur, ...patch } } })
}

/** Всё, что нужно для расчёта баллов, одним набором (пересчёт, предпросмотр, «почему он здесь») */
export async function loadInputs(container: MedusaContainer, now = new Date()) {
  const [{ config, version }, rules, items, extra, events] = await Promise.all([
    activeConfig(container), allRules(container), loadCatalogItems(container), cardExtra(container), eventSums(container, now),
  ])
  return { config, version, rules, items, extra, events, now }
}

export const saleActive = (rules: ManualRule[], now: Date) => rules.some((r) => r.kind === "sale" && isActive(r, now))

let running = false

/**
 * Пересчитать баллы всех карточек по трём зонам. Новый балл записывается, только если отличается от сохранённого
 * больше чем на write_threshold, либо изменились множители (остаток, ручное правило) или компонент «Размеры».
 * force — записать всё (после смены настроек).
 */
export async function recomputeScores(container: MedusaContainer, opts: { force?: boolean } = {}): Promise<SortState> {
  if (running) return sortState(container)
  running = true
  const started = Date.now()
  const now = new Date()
  try {
    const { config, version, rules, items, extra, events } = await loadInputs(container, now)
    const cards = buildCards(items, extra, events, rules, now)
    const ctx = { cfg: config, now, stats_days: events.days, sale: saleActive(rules, now) }
    const scores: CardScore[] = ZONES.flatMap((z) => scoreCards(cards, z, ctx))
    const existing = new Map((await svc(container).listSortProductScores({}, { take: 1_000_000 })).map((r) => [`${r.product_id}|${r.zone}`, r]))
    const create: Record<string, unknown>[] = [], update: Record<string, unknown>[] = []
    const alive = new Set<string>()
    for (const s of scores) {
      const key = `${s.id}|${s.zone}`
      alive.add(key)
      const row = {
        n: s.components.N, s: s.components.S, i: s.components.I, r: s.components.R, z: s.components.Z, m: s.components.M,
        multipliers: s.multipliers as unknown as Record<string, unknown>, k: s.k, score: s.score, profile: s.profile, calculated_at: now,
      }
      const ex = existing.get(key)
      if (!ex) { create.push({ product_id: s.id, zone: s.zone, ...row }); continue }
      const diff = ex.score > 0 ? Math.abs(s.score - ex.score) / ex.score : s.score > 0 ? 1 : 0
      if (opts.force || diff > config.write_threshold || Math.abs(ex.k - s.k) > 1e-6 || Math.abs(ex.r - s.components.R) > 1e-6 || ex.profile !== s.profile) update.push({ id: ex.id, ...row })
    }
    // Товар снят с сайта — балл больше не нужен
    const gone = [...existing].filter(([k]) => !alive.has(k)).map(([, r]) => r.id)
    for (let i = 0; i < create.length; i += 500) await svc(container).createSortProductScores(create.slice(i, i + 500) as never)
    for (let i = 0; i < update.length; i += 500) await svc(container).updateSortProductScores(update.slice(i, i + 500) as never)
    if (gone.length) await svc(container).deleteSortProductScores(gone)
    const written = create.length + update.length + gone.length
    const state: Partial<SortState> = {
      last_run_at: now.toISOString(), last_ok_at: now.toISOString(), error: null, cards: cards.length, written, ms: Date.now() - started,
      profile: scores[0]?.profile ?? null, config_version: version,
      ...(written ? { scores_version: now.toISOString() } : {}),
    }
    await saveState(container, state)
    if (written) await revalidateCatalog()
    return { ...(await sortState(container)) }
  } catch (e) {
    await saveState(container, { last_run_at: now.toISOString(), error: (e as Error).message }).catch(() => null)
    throw e
  } finally {
    running = false
  }
}

// ——— Витрине: баллы и настройки разведения ———

/** Добавить к карточкам каталога балл (центральная зона) и признак «мало показов». Баллов нет — поле не заполняется */
export async function attachScores(container: MedusaContainer, items: CatalogItem[], zone: Zone = "central"): Promise<CatalogItem[]> {
  const [{ config }, rows, events] = await Promise.all([activeConfig(container), svc(container).listSortProductScores({ zone }, { take: 1_000_000, select: ["product_id", "score"] }), eventSums(container)])
  const byId = new Map(rows.map((r) => [r.product_id, r.score]))
  return items.map((i) => ({
    ...i,
    ...(byId.has(i.id) ? { score: Math.round(byId.get(i.id)! * 10000) / 10000 } : {}),
    low_stats: (events.byProduct.get(i.id)?.i ?? 0) < config.quota.max_impressions,
  }))
}

export const arrangeConfig = (config: SortConfig, profile: string | null): ArrangeConfig => ({
  penalties: config.penalties, windows: config.windows, limits: config.limits, candidates: config.candidates,
  // На профиле «Запуск» квота выключена: статистики нет ни у кого
  quota: { every: profile === "launch" ? 0 : config.quota.every, last: config.quota.last },
})

export type StoreSort = {
  /** Версия порядка: меняется при пересчёте баллов, смене настроек и правил */
  version: string
  arrange: ArrangeConfig
  /** Действующие закрепления и дропы */
  pins: StorePin[]
}

export async function storeSort(container: MedusaContainer, now = new Date()): Promise<StoreSort> {
  const [{ config, version }, rules, state, events] = await Promise.all([activeConfig(container), allRules(container), sortState(container), eventSums(container, now)])
  const profile = activeProfile(config, seasonState(now, "central", config), events.days)
  const active = rules.filter((r) => (r.kind === "pin" || r.kind === "drop") && isActive(r, now) && r.target)
  return {
    version: `${version}.${state.scores_version ?? "0"}.${active.map((r) => r.id.slice(-6)).join("")}`,
    arrange: arrangeConfig(config, profile),
    pins: active.map((r) => ({ id: r.target!, listing: r.listing, position: r.position ?? 1, kind: r.kind as "pin" | "drop" })),
  }
}

// ——— Листинги на сервере (админка: «Почему он здесь», предпросмотр, отчёт) ———

/** Новинка — как на витрине: флажок или поступила после запуска и не старше 45 дней */
export const isNewItem = (i: CatalogItem, now: Date) => i.new_manual || (!i.initial_import && now.getTime() - Date.parse(i.created_at) < NEW_DAYS * DAY)

/**
 * Карточки листинга по ключу: all, new, outlet, gender:men, cat:kurtki, brand:calvin-klein, color:black
 * и их сочетания через «/» (gender:men/cat:kurtki). Как на витрине: только в наличии.
 */
export function listingItems(items: CatalogItem[], key: string, now: Date): CatalogItem[] {
  const parts = key.split("/").map((p) => p.split(":"))
  const get = (k: string) => parts.find((p) => p[0] === k)?.[1]
  const has = (k: string) => parts.some((p) => p[0] === k)
  let res = items.filter((i) => {
    if (!i.in_stock) return false
    const g = get("gender")
    if (g && i.gender !== g && i.gender !== "unisex") return false
    if (get("cat") && i.category?.handle !== get("cat")) return false
    if (get("brand") && i.brand?.handle !== get("brand")) return false
    if (get("color") && i.color !== get("color")) return false
    if (has("outlet") && !i.outlet) return false
    return true
  })
  if (has("new")) {
    const fresh = res.filter((i) => isNewItem(i, now))
    res = fresh.length ? fresh : [...res].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 96)
  }
  return res
}
