import { COMPONENTS, MatrixRow, ProfileKey, SortConfig, Warmth, Weights, Zone, ZONES } from "./config"
import { seasonState, SeasonState, seasonZ } from "./season"

/**
 * Этап 1 (ТЗ, раздел 3): балл карточки 0…1 — взвешенная сумма шести компонентов × множители K.
 * Score = (wN·N + wS·S + wI·I + wR·R + wZ·Z + wM·M) × K. Только расчёты, без базы.
 */

export type CardInput = {
  id: string
  category: string | null
  brand: string | null
  /** Строка матрицы сезонности и признак утеплённости */
  row: MatrixRow
  warmth: Warmth | null
  collection: string | null
  /** Дней с первой приёмки; null — дата неизвестна (стартовый ассортимент) */
  age_days: number | null
  /** Продано за 30 дней по модели (сайт и розница) */
  orders_30d: number
  impressions_30d: number
  clicks_30d: number
  carts_30d: number
  /** Размерная сетка и размеры в наличии (в нормальном виде: S, M, 32…) */
  sizes: string[]
  sizes_in_stock: string[]
  /** Группа размеров для справочника спроса: top, bottom, shoes, none */
  size_group: string
  stock_units: number
  /** Цена со скидкой, старая цена, закупка */
  price: number
  compare_at: number | null
  cost: number | null
  preorder: boolean
  in_stock: boolean
  photos: number
  /** Ручные множители (буст, понижение) — уже перемножены */
  manual: number
  manual_notes: string[]
}

export type Multiplier = { code: string; label: string; value: number }
export type CardScore = {
  id: string
  zone: Zone
  components: Weights
  multipliers: Multiplier[]
  k: number
  score: number
  profile: ProfileKey
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** p-й перцентиль (0…1) отсортированного списка, линейная интерполяция */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** Буква размера: «46 (S)» → S, «2XL» → XXL; нет — сам размер */
export function sizeKey(size: string): string {
  const s = size.toUpperCase().replace(/Х/g, "X").replace(/М/g, "M").replace(/С/g, "S")
  const m = s.match(/(?:^|[^A-Z0-9])(\d?X{0,3}[SL]|M|[23]XL)(?:$|[^A-Z0-9])/)
  if (!m) return s.trim()
  return m[1].replace(/^2X/, "XX").replace(/^3X/, "XXX")
}

/** R: сумма долей спроса по размерам в наличии. Нет справочника для группы — доля размеров в наличии. Без сетки — 1 */
export function sizeScore(c: Pick<CardInput, "sizes" | "sizes_in_stock" | "size_group" | "in_stock">, cfg: SortConfig): number {
  if (!c.in_stock) return 0
  if (c.sizes.length <= 1) return 1
  const table = cfg.size_demand[c.size_group]
  const known = table ? c.sizes.filter((s) => table[sizeKey(s)] !== undefined) : []
  // Справочник покрывает сетку — считаем по нему; иначе все размеры равны
  if (table && known.length >= c.sizes.length / 2) return clamp01(c.sizes_in_stock.reduce((a, s) => a + (table[sizeKey(s)] ?? 0), 0))
  return clamp01(c.sizes_in_stock.length / c.sizes.length)
}

/** Профиль весов: заданный в настройках или автоматически по правилам «когда включать» */
export function activeProfile(cfg: SortConfig, st: SeasonState, statsDays: number): ProfileKey {
  if (cfg.profile !== "auto") return cfg.profile
  if (statsDays < cfg.launch_days) return "launch"
  const edge = cfg.season_edge_weeks * 7
  if (st.since < edge) return "season_start"
  if (st.left <= edge) return "season_end"
  return "base"
}

export type ScoreContext = {
  cfg: SortConfig
  now: Date
  /** Сколько дней на сайте собирается статистика показов */
  stats_days: number
  /** Режим «Распродажа» включён */
  sale: boolean
}

type CatStats = { max_orders: number; ctr: number; atc: number; p95: number }

/** Средние и максимумы по категориям для S и I */
function categoryStats(cards: CardInput[], cfg: SortConfig): Map<string, CatStats> {
  const groups = new Map<string, CardInput[]>()
  for (const c of cards) groups.set(c.category ?? "", [...(groups.get(c.category ?? "") ?? []), c])
  const out = new Map<string, CatStats>()
  for (const [k, list] of groups) {
    const imp = list.reduce((a, c) => a + c.impressions_30d, 0)
    const ctr = imp ? list.reduce((a, c) => a + c.clicks_30d, 0) / imp : 0
    const atc = imp ? list.reduce((a, c) => a + c.carts_30d, 0) / imp : 0
    const raw = list.map((c) => interestRaw(c, ctr, atc, cfg)).sort((a, b) => a - b)
    out.set(k, { max_orders: Math.max(0, ...list.map((c) => c.orders_30d)), ctr, atc, p95: percentile(raw, 0.95) })
  }
  return out
}

/** CTR + 1.5·ATC, сглаженные к среднему по категории */
function interestRaw(c: CardInput, ctrCat: number, atcCat: number, cfg: SortConfig): number {
  const ctr = (c.clicks_30d + cfg.smoothing * ctrCat) / (c.impressions_30d + cfg.smoothing)
  const atc = (c.carts_30d + cfg.smoothing * atcCat) / (c.impressions_30d + cfg.smoothing)
  return (Number.isFinite(ctr) ? ctr : 0) + cfg.atc_weight * (Number.isFinite(atc) ? atc : 0)
}

export const margin = (c: Pick<CardInput, "price" | "cost">) => (c.cost && c.cost > 0 && c.price > 0 ? (c.price - c.cost) / c.price : null)

/** Баллы всех карточек для одной климатической зоны */
export function scoreCards(cards: CardInput[], zone: Zone, ctx: ScoreContext): CardScore[] {
  const { cfg } = ctx
  const st = seasonState(ctx.now, zone, cfg)
  const profile = activeProfile(cfg, st, ctx.stats_days)
  const w = cfg.profiles[profile]
  const cats = categoryStats(cards, cfg)
  const margins = cards.map(margin).filter((m): m is number => m !== null).sort((a, b) => a - b)
  const m5 = percentile(margins, 0.05), m95 = percentile(margins, 0.95)

  return cards.map((c) => {
    const cat = cats.get(c.category ?? "")!
    const N = c.age_days === null ? 0 : Math.exp(-Math.max(0, c.age_days) / cfg.novelty_days)
    const S = cat.max_orders > 0 ? Math.log(1 + c.orders_30d) / Math.log(1 + cat.max_orders) : 0
    const I = cat.p95 > 0 ? Math.min(1, interestRaw(c, cat.ctr, cat.atc, cfg) / cat.p95) : 0
    const R = sizeScore(c, cfg)
    const Z = seasonZ(c, st, cfg).z
    const mg = margin(c)
    // Закупки нет — нейтральная середина
    const marginNorm = mg === null || m95 <= m5 ? 0.5 : clamp01((mg - m5) / (m95 - m5))
    const M = cfg.margin_weight * marginNorm + cfg.brand_weight * (cfg.brand_priority[c.brand ?? ""] ?? 0.5)
    const components: Weights = { N, S, I, R, Z, M }

    const mult: Multiplier[] = []
    const x = cfg.multipliers
    if (c.in_stock && c.sizes.length >= x.one_size_min_grid && c.sizes_in_stock.length === 1) mult.push({ code: "one_size", label: "в наличии один размер", value: x.one_size })
    if (c.preorder) mult.push({ code: "preorder", label: "предзаказ", value: x.preorder })
    const daily = c.orders_30d / 30
    if (c.in_stock && !c.preorder && (c.age_days === null || c.age_days > x.overstock_min_age) && c.stock_units > 0 && (daily === 0 || c.stock_units / daily > x.overstock_days)) {
      mult.push({ code: "overstock", label: `запас больше ${x.overstock_days} дн.`, value: x.overstock })
    }
    if (c.manual !== 1) mult.push({ code: "manual", label: c.manual_notes.join("; ") || "ручное правило", value: c.manual })
    if (ctx.sale && c.compare_at && c.compare_at > c.price) {
      mult.push({ code: "sale", label: "режим «Распродажа»", value: Math.min(x.sale_cap, 1 + (1 - c.price / c.compare_at)) })
    }
    if (!c.in_stock && !c.preorder) mult.push({ code: "out", label: "нет в наличии", value: 0 })
    const k = mult.reduce((a, m) => a * m.value, 1)
    const score = COMPONENTS.reduce((a, key) => a + w[key] * components[key], 0) * k
    return { id: c.id, zone, components, multipliers: mult, k, score, profile }
  })
}

export const scoreAllZones = (cards: CardInput[], ctx: ScoreContext): CardScore[] => ZONES.flatMap((z) => scoreCards(cards, z, ctx))
