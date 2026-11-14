import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CatalogItem } from "../catalog/store-catalog"
import { SORT_MODULE } from "../../modules/sort"
import SortModuleService from "../../modules/sort/service"
import { arrange, ArrangeItem, pinsFor, Placed } from "./arrange"
import { COMPONENTS, SortConfig, Weights, Zone } from "./config"
import { arrangeConfig, buildCards, isActive, listingItems, loadInputs, ManualRule, mskDay, saleActive, storeSort } from "./engine"
import { activeProfile, Multiplier, scoreCards } from "./score"
import { seasonState } from "./season"

/** Экраны админки: «Почему он здесь», предпросмотр «было / станет», отчёт по неделям */

export type WhyRow = Placed & {
  title: string; thumbnail: string | null; brand: string | null; color: string | null; category: string | null; price: number
  components: Weights | null; contributions: Weights | null; multipliers: Multiplier[]; k: number | null; profile: string | null
  impressions_30d: number
}

type Scored = { score: number; components: Weights; multipliers: Multiplier[]; k: number; profile: string }

function toArrange(items: CatalogItem[], scores: Map<string, Scored>, lowStats: (id: string) => boolean): ArrangeItem[] {
  return items.map((i) => ({
    id: i.id, score: scores.get(i.id)?.score ?? 0, brand: i.brand?.handle ?? null, color: i.color, category: i.category?.handle ?? null,
    price: i.price, model: i.model ?? i.id, low_stats: lowStats(i.id),
  }))
}

function rowsOf(placed: Placed[], items: CatalogItem[], scores: Map<string, Scored>, cfg: SortConfig, impressions: (id: string) => number): WhyRow[] {
  const by = new Map(items.map((i) => [i.id, i]))
  return placed.map((p) => {
    const i = by.get(p.id)!
    const s = scores.get(p.id)
    const w = s ? cfg.profiles[s.profile as keyof SortConfig["profiles"]] ?? cfg.profiles.base : null
    return {
      ...p, title: i.title, thumbnail: i.thumbnail, brand: i.brand?.name ?? null, color: i.color_name ?? i.color, category: i.category?.name ?? null, price: i.price,
      components: s?.components ?? null,
      contributions: s && w ? (Object.fromEntries(COMPONENTS.map((k) => [k, w[k] * s.components[k]])) as Weights) : null,
      multipliers: s?.multipliers ?? [], k: s?.k ?? null, profile: s?.profile ?? null, impressions_30d: impressions(p.id),
    }
  })
}

/** Баллы из таблицы sort_product_score — те же числа, по которым сортирует витрина */
async function storedScores(container: MedusaContainer, zone: Zone): Promise<Map<string, Scored>> {
  const svc: SortModuleService = container.resolve(SORT_MODULE)
  const rows = await svc.listSortProductScores({ zone }, { take: 1_000_000 })
  return new Map(rows.map((r) => [r.product_id, {
    score: r.score, components: { N: r.n, S: r.s, I: r.i, R: r.r, Z: r.z, M: r.m }, multipliers: (r.multipliers as unknown as Multiplier[]) ?? [], k: r.k, profile: r.profile,
  }]))
}

/** Листинг глазами покупателя с объяснением каждой позиции (по сохранённым баллам) */
export async function whyListing(container: MedusaContainer, key: string, zone: Zone = "central"): Promise<{ rows: WhyRow[]; total: number }> {
  const inp = await loadInputs(container)
  const [scores, sort] = await Promise.all([storedScores(container, zone), storeSort(container, inp.now)])
  const items = listingItems(inp.items, key, inp.now)
  const imp = (id: string) => inp.events.byProduct.get(id)?.i ?? 0
  const placed = arrange(
    toArrange(items, scores, (id) => imp(id) < inp.config.quota.max_impressions), sort.arrange,
    pinsFor(sort.pins, key, items.map((i) => ({ id: i.id, brand: i.brand?.handle ?? null })))
  )
  return { rows: rowsOf(placed, items, scores, inp.config, imp), total: items.length }
}

/** Предпросмотр: порядок сейчас и порядок с черновиком настроек (ничего не сохраняет) */
export async function previewListing(container: MedusaContainer, key: string, draft: SortConfig, zone: Zone = "central", take = 48) {
  const inp = await loadInputs(container)
  const items = listingItems(inp.items, key, inp.now)
  const imp = (id: string) => inp.events.byProduct.get(id)?.i ?? 0
  const pins = (rules: ManualRule[]) => pinsFor(
    rules.filter((r) => (r.kind === "pin" || r.kind === "drop") && isActive(r, inp.now) && r.target).map((r) => ({ id: r.target!, listing: r.listing, position: r.position ?? 1, kind: r.kind as "pin" | "drop" })),
    key, items.map((i) => ({ id: i.id, brand: i.brand?.handle ?? null }))
  )
  const cards = buildCards(inp.items, inp.extra, inp.events, inp.rules, inp.now)
  const run = (cfg: SortConfig) => {
    const ctx = { cfg, now: inp.now, stats_days: inp.events.days, sale: saleActive(inp.rules, inp.now) }
    const scores = new Map(scoreCards(cards, zone, ctx).map((s) => [s.id, { score: s.score, components: s.components, multipliers: s.multipliers, k: s.k, profile: s.profile }]))
    const profile = activeProfile(cfg, seasonState(inp.now, zone, cfg), inp.events.days)
    const placed = arrange(toArrange(items, scores, (id) => imp(id) < cfg.quota.max_impressions), arrangeConfig(cfg, profile), pins(inp.rules))
    return rowsOf(placed.slice(0, take), items, scores, cfg, imp)
  }
  return { before: run(inp.config), after: run(draft), total: items.length }
}

export type ReportWeek = {
  /** Понедельник недели, ГГГГ-ММ-ДД */
  week: string
  impressions: number; clicks: number; carts: number; visits: number
  /** CTR позиций 1–24, % */
  ctr_top: number | null
  /** Добавлений в корзину на 100 визитов листинга */
  carts_per_100: number | null
  /** Доля карточек каталога с 100 и более показами за неделю, % */
  coverage: number | null
}

/** Метрики из раздела 9 по неделям (что можно посчитать из событий сайта) + доля топ-бренда в позициях 1–24 «Всей одежды» сейчас */
export async function sortReport(container: MedusaContainer, weeks = 8): Promise<{ weeks: ReportWeek[]; top_brand: { brand: string | null; share: number } | null; cards: number }> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const since = mskDay(new Date(Date.now() - weeks * 7 * 86_400_000))
  const rows = (await pg.raw(
    `select to_char(date_trunc('week', day::date), 'YYYY-MM-DD') as week,
       sum(case when product_id <> '*' then impressions else 0 end)::int as impressions, sum(clicks)::int as clicks, sum(carts)::int as carts,
       sum(case when product_id = '*' then impressions else 0 end)::int as visits,
       sum(impressions_top)::int as it, sum(clicks_top)::int as ct
     from sort_listing_event where day >= ? and deleted_at is null group by 1 order by 1 desc`, [since]
  )).rows as { week: string; impressions: number; clicks: number; carts: number; visits: number; it: number; ct: number }[]
  const cover = (await pg.raw(
    `select week, count(*)::int as n from (
       select to_char(date_trunc('week', day::date), 'YYYY-MM-DD') as week, product_id, sum(impressions) as i
       from sort_listing_event where day >= ? and product_id <> '*' and deleted_at is null group by 1, 2) t where i >= 100 group by week`, [since]
  )).rows as { week: string; n: number }[]
  const covered = new Map(cover.map((r) => [r.week, r.n]))
  const all = await whyListing(container, "all")
  const top = all.rows.slice(0, 24)
  const brands = new Map<string | null, number>()
  for (const r of top) brands.set(r.brand, (brands.get(r.brand) ?? 0) + 1)
  const best = [...brands].sort((a, b) => b[1] - a[1])[0]
  return {
    cards: all.total,
    top_brand: best && top.length ? { brand: best[0], share: Math.round((best[1] / top.length) * 100) } : null,
    weeks: rows.map((r) => ({
      week: r.week, impressions: r.impressions, clicks: r.clicks, carts: r.carts, visits: r.visits,
      ctr_top: r.it ? Math.round((r.ct / r.it) * 1000) / 10 : null,
      carts_per_100: r.visits ? Math.round((r.carts / r.visits) * 1000) / 10 : null,
      coverage: all.total ? Math.round(((covered.get(r.week) ?? 0) / all.total) * 1000) / 10 : null,
    })),
  }
}
