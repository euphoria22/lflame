import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { loadCatalogItems, loadCatalogProduct } from "../catalog/store-catalog"
import { activeAutoPromos, autoPrice, promoProducts } from "../promotions/auto-price"
import { telegramApi, TelegramError } from "../notify/telegram"
import { ensureVkGroupId, uploadWallPhotos, vkApi, vkConfigured, vkGroupId, vkPostLink } from "../vk/client"
import { buildVkText } from "../vk/post"
import { site } from "../notify/templates"
import { DEFAULT_SCHEDULE, dueSlot, TgSchedule, validateSchedule } from "./schedule"
import { modelKeys } from "../catalog/model-key"
import { SORT_MODULE } from "../../modules/sort"
import SortModuleService from "../../modules/sort/service"
import { activeConfig } from "../sort/engine"
import { BaseScore, buildCaption, categoryDemand, mixOrder, postLink, postPhotos, postState, PostProduct, RecItem, recommend, Recommendation, TgMeta, tgMetaOf } from "./post"

/**
 * Посты о товарах в Telegram-канале магазина (TELEGRAM_CHANNEL_ID: @имя_канала или -100…).
 * Бот (тот же, что шлёт уведомления) должен быть администратором канала с правом публиковать и редактировать.
 * История постов хранится в metadata.tg товара: сколько раз и когда выкладывали; подпись обновляется,
 * когда меняется цена или размеры в наличии.
 */
export const channelId = () => process.env.TELEGRAM_CHANNEL_ID?.trim() || null
export const contact = () => process.env.TELEGRAM_ORDER_CONTACT?.trim() || "@laflammehelp"

/** Соцсеть: tg — Telegram-канал, vk — сообщество ВКонтакте. У каждой своя очередь, расписание и история постов в товаре */
export type Net = "tg" | "vk"
export const NETS: Net[] = ["tg", "vk"]
export const NET_NAME: Record<Net, string> = { tg: "Telegram", vk: "ВКонтакте" }
export const asNet = (v: unknown): Net => (v === "vk" ? "vk" : "tg")
export const netConfigured = (net: Net) => (net === "vk" ? vkConfigured() : Boolean(channelId() && process.env.TELEGRAM_BOT_TOKEN))
export const postUrl = (net: Net, id: number) => (net === "vk" ? vkPostLink(id) : channelId() ? postLink(channelId()!, id) : null)

type Logger = { info: (m: string) => void; warn: (m: string) => void }

export async function readMeta(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata"], filters: { id } })
  return data[0] as { id: string; handle: string; metadata: Record<string, unknown> | null } | undefined
}

export async function saveTg(container: MedusaContainer, id: string, tg: TgMeta, net: Net = "tg") {
  const row = await readMeta(container, id)
  if (!row) return
  await updateProductsWorkflow(container).run({ input: { products: [{ id, metadata: { ...(row.metadata ?? {}), [net]: tg } }] } })
}

/** Цены по действующим автоматическим акциям для товаров (id → цена акции) */
export async function promoPrices(container: MedusaContainer, items: { id: string; price: number }[]) {
  const promos = await activeAutoPromos(container)
  const out = new Map<string, ReturnType<typeof autoPrice>>()
  if (!promos.length || !items.length) return out
  const products = await promoProducts(container, items.map((i) => i.id))
  for (const i of items) {
    const p = products.get(i.id)
    out.set(i.id, p ? autoPrice(i.price, p, promos) : null)
  }
  return out
}

export async function postProduct(container: MedusaContainer, handle: string): Promise<PostProduct | null> {
  const p = await loadCatalogProduct(container, handle)
  if (!p || p.discontinued) return null
  const promo = (await promoPrices(container, [p])).get(p.id) ?? null
  return {
    handle: p.handle, title: p.title, price: p.price, compare_at: p.compare_at, promo, preorder: p.preorder, preorder_date: p.preorder_date, outlet: p.outlet,
    description: p.has_description ? p.description : null, specs: p.specs, sizes: p.sizes, images: p.images,
  }
}

/** Telegram просит подождать — ждём и повторяем один раз */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof TelegramError && e.retryAfter) {
      await new Promise((r) => setTimeout(r, (e.retryAfter! + 1) * 1000))
      return fn()
    }
    throw e
  }
}

/**
 * Фото скачиваем сами (сжатые сайтом, 1080 px, JPEG; не вышло — оригинал) и загружаем в Telegram файлами:
 * по ссылке Telegram из-за границы не всегда может скачать фото с российского сервера (WEBPAGE_CURL_FAILED).
 */
export async function downloadPhoto(url: string, original: string): Promise<Blob | null> {
  for (const u of [url, original]) {
    try {
      const r = await fetch(u, { headers: { Accept: "image/jpeg,image/png;q=0.9" }, signal: AbortSignal.timeout(40_000) })
      const type = r.headers.get("content-type") ?? ""
      if (!r.ok || !/^image\/(jpeg|png|webp)/.test(type)) continue
      const buf = await r.arrayBuffer()
      // Лимит Telegram на фото — 10 МБ
      if (buf.byteLength > 0 && buf.byteLength < 10 * 1024 * 1024) return new Blob([buf], { type })
    } catch {
      // следующий вариант
    }
  }
  return null
}

/** Альбом с подписью у первого фото; фото — файлами. Нескачавшиеся фото пропускаем. */
export async function sendAlbum(chat: string, photos: string[], originals: string[], caption: string): Promise<{ message_id: number }[]> {
  const files = (await Promise.all(photos.map((u, i) => downloadPhoto(u, originals[i] ?? u)))).filter((b): b is Blob => b !== null)
  if (!files.length) throw new Error("Не удалось скачать фото товара")
  const form = new FormData()
  form.append("chat_id", chat)
  files.forEach((b, i) => form.append(`p${i}`, b, `p${i}.${b.type.split("/")[1] === "jpeg" ? "jpg" : b.type.split("/")[1]}`))
  // Одно фото — альбомом не отправить: sendMediaGroup требует от 2 штук
  if (files.length === 1) {
    form.append("photo", "attach://p0")
    form.append("caption", caption)
    form.append("parse_mode", "HTML")
    return [await withRetry(() => telegramApi<{ message_id: number }>("sendPhoto", form))]
  }
  form.append("media", JSON.stringify(files.map((_, i) => ({ type: "photo", media: `attach://p${i}`, ...(i === 0 ? { caption, parse_mode: "HTML" } : {}) }))))
  return withRetry(() => telegramApi<{ message_id: number }[]>("sendMediaGroup", form))
}

/** Выложить товар во ВКонтакте: фото загружаются файлами, текст без разметки */
async function publishVk(container: MedusaContainer, productId: string): Promise<{ id: number; link: string | null }> {
  if (!vkConfigured()) throw new Error("ВКонтакте не настроен: VK_GROUP_ID и VK_ACCESS_TOKEN в настройках сервера")
  const row = await readMeta(container, productId)
  if (!row) throw new Error("Товар не найден")
  const p = await postProduct(container, row.handle)
  if (!p) throw new Error("Товар не опубликован на сайте")
  if (!p.images.length) throw new Error("У товара нет фото")
  const urls = postPhotos(p.images, site())
  const files = (await Promise.all(urls.map((u, i) => downloadPhoto(u, p.images[i] ?? u)))).filter((b): b is Blob => b !== null)
  if (!files.length) throw new Error("Не удалось скачать фото товара")
  const group = await ensureVkGroupId()
  const att = (await uploadWallPhotos(files)).join(",")
  if (!att) throw new Error("ВКонтакте не принял фото")
  const r = await vkApi<{ post_id: number }>("wall.post", { owner_id: `-${group}`, from_group: 1, message: buildVkText(p, { site: site(), contact: contact() }), attachments: att })
  const vk = tgMetaOf(row.metadata, "vk")
  await saveTg(container, productId, { posts: [...vk.posts, { id: r.post_id, at: new Date().toISOString(), att }], state: postState(p) }, "vk")
  return { id: r.post_id, link: vkPostLink(r.post_id) }
}

/** Выложить товар в канал альбомом с подписью (Telegram) или постом сообщества (ВКонтакте). Возвращает ссылку на пост. */
export async function publishProduct(container: MedusaContainer, productId: string, net: Net = "tg"): Promise<{ id: number; link: string | null }> {
  if (net === "vk") return publishVk(container, productId)
  const chat = channelId()
  if (!chat) throw new Error("Не задан канал: TELEGRAM_CHANNEL_ID в настройках сервера")
  const row = await readMeta(container, productId)
  if (!row) throw new Error("Товар не найден")
  const p = await postProduct(container, row.handle)
  if (!p) throw new Error("Товар не опубликован на сайте")
  if (!p.images.length) throw new Error("У товара нет фото")

  const caption = buildCaption(p, { site: site(), contact: contact() })
  const sent = await sendAlbum(chat, postPhotos(p.images, site()), p.images, caption)
  const id = sent[0].message_id
  const tg = tgMetaOf(row.metadata)
  await saveTg(container, productId, { posts: [...tg.posts, { id, at: new Date().toISOString() }], state: postState(p) })
  return { id, link: postLink(chat, id) }
}

/**
 * Обновить подписи опубликованных постов, если цена или размеры изменились (раз в 10 минут после сверки остатков).
 * Удалённый вручную пост забываем. Telegram и ВКонтакте — по отдельности.
 */
export async function refreshPosts(container: MedusaContainer, log: Logger): Promise<number> {
  let edited = 0
  // ВКонтакте: опубликованные посты не правим (алгоритмы ленты), отложенные обновляет планировщик (lib/vk/plan.ts)
  for (const net of ["tg"] as Net[]) {
    if (!netConfigured(net)) continue
    try {
      edited += await refreshNet(container, log, net)
    } catch (e) {
      log.warn(`${NET_NAME[net]}: подписи постов не обновлены: ${(e as Error).message}`)
    }
  }
  return edited
}

async function refreshNet(container: MedusaContainer, log: Logger, net: Net): Promise<number> {
  const chat = channelId()
  if (net === "vk") await ensureVkGroupId()
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata"], pagination: { take: 100000 } })
  const posted = (data as { id: string; handle: string; metadata: Record<string, unknown> | null }[])
    .map((r) => ({ ...r, tg: tgMetaOf(r.metadata, net) }))
    .filter((r) => r.tg.posts.length)
  if (!posted.length) return 0
  // Цена и размеры всех товаров — одним запросом; полную карточку грузим, только если что-то изменилось
  const items = new Map((await loadCatalogItems(container)).map((i) => [i.handle, i]))
  // Акция началась или закончилась — подпись тоже обновится
  const promos = await promoPrices(container, posted.map((r) => items.get(r.handle)).filter((i): i is NonNullable<typeof i> => Boolean(i)))
  let edited = 0
  for (const r of posted) {
    const item = items.get(r.handle)
    // Снят с сайта — пост не трогаем
    if (!item) continue
    const state = postState({ ...item, promo: promos.get(item.id) ?? null })
    if (state === r.tg.state) continue
    const product = await postProduct(container, r.handle)
    if (!product) continue
    const alive: typeof r.tg.posts = []
    for (const post of r.tg.posts) {
      try {
        if (net === "vk") {
          // Вложения передаём снова: без них ВКонтакте уберёт фото из поста
          await vkApi("wall.edit", { owner_id: `-${vkGroupId()}`, post_id: post.id, message: buildVkText(product, { site: site(), contact: contact() }), attachments: post.att })
        } else {
          const caption = buildCaption(product, { site: site(), contact: contact() })
          await withRetry(() => telegramApi("editMessageCaption", { chat_id: chat, message_id: post.id, caption, parse_mode: "HTML" }))
        }
        alive.push(post)
        edited++
      } catch (e) {
        const msg = (e as Error).message
        if (/not modified/i.test(msg)) alive.push(post)
        else if (/not found|can't be edited|post was deleted|access denied|код 100/i.test(msg)) log.info(`${NET_NAME[net]}: пост ${post.id} удалён — больше не обновляем`)
        else { log.warn(`${NET_NAME[net]}: не обновилась подпись поста ${post.id}: ${msg}`); alive.push(post) }
      }
      await new Promise((res) => setTimeout(res, 1500))
    }
    await saveTg(container, r.id, { posts: alive, state }, net)
  }
  return edited
}

// ——— Обзор для страницы «Telegram» в админке ———

export type OverviewRow = RecItem & { link: string | null; recommendation: Recommendation | null }

export type Overview = {
  configured: { channel: string | null; token: boolean }
  net: Net
  totals: { products: number; posted: number; never: number; posts: number; last7: number; last30: number }
  rows: OverviewRow[]
}

const DAY = 86_400_000

export async function telegramOverview(container: MedusaContainer, net: Net = "tg"): Promise<Overview> {
  // Номер сообщества по короткому имени — для ссылок на посты
  if (net === "vk" && vkConfigured()) await ensureVkGroupId().catch(() => null)
  const items = await loadCatalogItems(container)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "description"], filters: { id: items.map((i) => i.id) }, pagination: { take: 100000 } })
  const metaById = new Map((data as { id: string; metadata: Record<string, unknown> | null }[]).map((r) => [r.id, tgMetaOf(r.metadata, net)]))

  const now = new Date()
  const chat = channelId()
  const promos = await promoPrices(container, items)
  const keyOf = modelKeys(items)
  const allPosts = items.flatMap((i) => (metaById.get(i.id)?.posts ?? []).map((p) => ({ ...p, brand: i.brand?.name ?? null, category: i.category?.name ?? null, model: keyOf.get(i.id) ?? i.id })))
  const recentBrands = new Set(allPosts.filter((p) => now.getTime() - Date.parse(p.at) < 3 * DAY && p.brand).map((p) => p.brand!))
  // Спрос по разделам — по всем товарам, включая распроданные
  // Балл умной сортировки каталога (центральная зона) — основа рекомендации; веса — из настроек «Сортировка»
  const [{ config }, scoreRows] = await Promise.all([
    activeConfig(container),
    (container.resolve(SORT_MODULE) as SortModuleService).listSortProductScores({ zone: "central" }, { take: 1_000_000 }).catch(() => [] as never[]),
  ])
  const base = new Map<string, BaseScore>()
  for (const r of scoreRows) {
    base.set(r.product_id, { score: r.score, components: { N: r.n, S: r.s, I: r.i, R: r.r, Z: r.z, M: r.m }, multipliers: (r.multipliers as unknown as BaseScore["multipliers"]) ?? [] })
  }
  const maxScore = Math.max(0, ...scoreRows.map((r) => r.score))
  const demand = categoryDemand(items.map((i) => ({ category_handle: i.category?.handle ?? null, sales: i.sales })))

  const rows: OverviewRow[] = items.map((i) => {
    const posts = metaById.get(i.id)?.posts ?? []
    const age = (now.getTime() - Date.parse(i.created_at)) / DAY
    const rec: RecItem = {
      id: i.id, handle: i.handle, title: i.title, thumbnail: i.thumbnail, brand: i.brand?.name ?? null, category: i.category?.name ?? null,
      price: i.price, compare_at: i.compare_at, promo: promos.get(i.id) ?? null, in_stock: i.in_stock, preorder: i.preorder, preorder_date: i.preorder_date,
      sizes_in_stock: i.sizes.filter((s) => s.in_stock).length, sizes_total: i.sizes.length,
      images: i.images_count, has_description: i.has_description, sales: i.sales, stock_units: i.stock_units ?? 0, model_units: i.model_units ?? 0,
      is_new: i.new_manual || (!i.initial_import && age <= 21), created_at: i.created_at, posts,
    }
    const last = posts.at(-1)
    return {
      ...rec,
      link: last ? postUrl(net, last.id) : null,
      recommendation: recommend({ ...rec, category_handle: i.category?.handle ?? null, base: base.get(i.id) ?? null }, { now, recentBrands, demand, tg: config.telegram, maxScore }),
    }
  })

  // Очерёдность вперемешку: бренды, разделы и модели не идут подряд — с учётом последних постов канала
  // ВКонтакте: записи в отложке — тоже «последние посты» (чтобы бренды и разделы чередовались через всю неделю)
  const planned = net === "vk" ? (await readQueue(container, "vk")).planned ?? [] : []
  const itemById = new Map(items.map((i) => [i.id, i]))
  const plannedPosts = planned.map((p) => ({ at: p.at, brand: itemById.get(p.product_id)?.brand?.name ?? null, category: itemById.get(p.product_id)?.category?.name ?? null, model: keyOf.get(p.product_id) ?? p.product_id }))
  const recent = [...allPosts, ...plannedPosts].sort((a, b) => a.at.localeCompare(b.at)).slice(-8)
  const ranked = rows.filter((r) => r.recommendation)
    .map((r) => ({ id: r.id, brand: r.brand, category: r.category, model: keyOf.get(r.id) ?? r.id, score: r.recommendation!.score }))
    .sort((a, b) => b.score - a.score)
  const rowById = new Map(rows.map((r) => [r.id, r]))
  mixOrder(ranked, recent, config.telegram).forEach((r, n) => { rowById.get(r.id)!.recommendation!.order = n + 1 })

  const since = (d: number) => allPosts.filter((p) => now.getTime() - Date.parse(p.at) < d * DAY).length
  const posted = rows.filter((r) => r.posts.length).length
  return {
    net,
    configured: net === "vk"
      ? { channel: process.env.VK_GROUP_ID?.trim() ? `vk.com/${vkGroupId() ? `club${vkGroupId()}` : process.env.VK_GROUP_ID.trim().replace(/^.*\//, "")}` : null, token: Boolean(process.env.VK_ACCESS_TOKEN?.trim()) }
      : { channel: chat, token: Boolean(process.env.TELEGRAM_BOT_TOKEN) },
    totals: { products: rows.length, posted, never: rows.length - posted, posts: allPosts.length, last7: since(7), last30: since(30) },
    rows,
  }
}

// ——— Очередь по расписанию: хранится в metadata магазина, выкладывается по слотам (задача раз в минуту) ———

/** Отложенный пост ВКонтакте: товар, номер записи, время выхода, «отпечаток» цены и размеров, вложения, из рекомендаций ли */
export type PlannedPost = { product_id: string; post_id: number; at: string; state: string; att: string; auto: boolean }

export type TgQueueState = {
  schedule: TgSchedule; items: string[]; last_at: string | null; last_error: string | null
  /** ВКонтакте: отложенные записи, на сколько дней вперёд заполнять, товары, которые не ставить до даты (убраны вручную) */
  planned?: PlannedPost[]; horizon_days?: number; skip?: Record<string, string>
}

async function store(container: MedusaContainer) {
  const stores = (await container.resolve(Modules.STORE).listStores({}, { take: 1 })) as { id: string; metadata?: Record<string, unknown> | null }[]
  if (!stores[0]) throw new Error("Магазин не найден")
  return stores[0]
}

/** ВКонтакте по умолчанию реже: раз в 2 часа (алгоритмы ленты не любят частые посты) */
export const defaultSchedule = (net: Net): TgSchedule => (net === "vk" ? { ...DEFAULT_SCHEDULE, every: 120 } : DEFAULT_SCHEDULE)
const queueKey = (net: Net) => (net === "vk" ? "vk_queue" : "tg_queue")

export async function readQueue(container: MedusaContainer, net: Net = "tg"): Promise<TgQueueState> {
  const raw = ((await store(container)).metadata?.[queueKey(net)] ?? {}) as Partial<TgQueueState>
  return {
    schedule: raw.schedule ? validateSchedule(raw.schedule).value ?? defaultSchedule(net) : defaultSchedule(net),
    items: Array.isArray(raw.items) ? raw.items.filter((x): x is string => typeof x === "string") : [],
    last_at: raw.last_at ?? null,
    last_error: raw.last_error ?? null,
    ...(net === "vk" ? {
      planned: Array.isArray(raw.planned) ? raw.planned.filter((x) => x && typeof x.post_id === "number" && typeof x.product_id === "string") : [],
      horizon_days: Number.isInteger(raw.horizon_days) && raw.horizon_days! >= 1 && raw.horizon_days! <= 14 ? raw.horizon_days : 7,
      skip: raw.skip && typeof raw.skip === "object" ? raw.skip : {},
    } : {}),
  }
}

/** Изменить очередь: читаем свежую версию прямо перед записью, остальные данные магазина не трогаем */
export async function updateQueue(container: MedusaContainer, fn: (q: TgQueueState) => TgQueueState, net: Net = "tg"): Promise<TgQueueState> {
  const s = await store(container)
  const next = fn(await readQueue(container, net))
  const fresh = await store(container)
  await container.resolve(Modules.STORE).updateStores(s.id, { metadata: { ...(fresh.metadata ?? {}), [queueKey(net)]: next } })
  return next
}

export const addToQueue = (container: MedusaContainer, ids: string[], net: Net = "tg") =>
  updateQueue(container, (q) => ({ ...q, items: [...q.items, ...ids.filter((id) => !q.items.includes(id))] }), net)

const ticking: Record<Net, boolean> = { tg: false, vk: false }

/** Раз в минуту: наступил слот — выложить первый товар очереди (или лучшую рекомендацию, если включено). */
export async function queueTick(container: MedusaContainer, log: Logger, now = new Date(), net: Net = "tg"): Promise<void> {
  // ВКонтакте выкладывается отложенными записями заранее — см. lib/vk/plan.ts
  if (net === "vk" || ticking[net] || !netConfigured(net)) return
  ticking[net] = true
  try {
    const q = await readQueue(container, net)
    const slot = dueSlot(q.schedule, now, q.last_at)
    if (!slot) return
    let id: string | null = q.items[0] ?? null
    let fromQueue = Boolean(id)
    if (!id && q.schedule.auto) {
      const best = (await telegramOverview(container, net)).rows.find((r) => r.recommendation?.order === 1)
      id = best?.id ?? null
      fromQueue = false
    }
    if (!id) return
    let error: string | null = null
    try {
      const r = await publishProduct(container, id, net)
      log.info(`${NET_NAME[net]}: по расписанию выложен товар ${id} (пост ${r.id})`)
    } catch (e) {
      error = `${new Date().toLocaleString("ru-RU", { timeZone: q.schedule.tz })}: ${(e as Error).message}`
      log.warn(`${NET_NAME[net]}: товар ${id} не выложен: ${(e as Error).message}`)
    }
    // Слот отработан в любом случае: неудачный товар убираем из очереди, чтобы он не блокировал остальные
    await updateQueue(container, (cur) => ({
      ...cur,
      items: fromQueue ? cur.items.filter((x) => x !== id) : cur.items,
      last_at: now.toISOString(),
      last_error: error ?? cur.last_error,
    }), net)
  } finally {
    ticking[net] = false
  }
}
