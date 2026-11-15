/**
 * Офлайн-балл и роли товара (ТЗ, пп. 3.2, 3.4). Чистые функции.
 * Балл строится на продажах магазина (не сайта), марже, остатке, полноте размеров, новизне и сезоне.
 */

export type Role = "new" | "hit" | "hit_broken" | "second_chance" | "base" | "offseason" | "sale"

export const ROLE_NAME: Record<Role, string> = {
  new: "Новинка", hit: "Хит", hit_broken: "Хит, мало размеров", second_chance: "Второй шанс",
  base: "База", offseason: "Не сезон", sale: "Распродажа",
}

export type OfflineInput = {
  q30: number
  q60: number
  units: number
  sizesIn: number
  sizesAll: number
  price: number
  cost: number | null
  fresh: boolean
  /** Сезонность 0…1 из умной сортировки */
  season: number
  outlet: boolean
}

export type OfflineWeights = { sales: number; margin: number; depth: number; sizes: number; fresh: number; season: number }
export const DEFAULT_WEIGHTS: OfflineWeights = { sales: 0.35, margin: 0.1, depth: 0.1, sizes: 0.15, fresh: 0.15, season: 0.15 }

export type OfflineResult = { score: number; role: Role; weeks: number | null }

/**
 * maxSales — наибольшие продажи (q30 + половина q61–60) среди товаров: продажи приводятся к 0…1 по логарифму,
 * чтобы один бестселлер не обнулял остальных.
 */
export function offlineScore(x: OfflineInput, maxSales: number, w: OfflineWeights = DEFAULT_WEIGHTS, hitLine = 0, hasRetail = true): OfflineResult {
  const sales = x.q30 + 0.5 * Math.max(0, x.q60 - x.q30)
  const S = maxSales > 0 ? Math.log1p(sales) / Math.log1p(maxSales) : 0
  const M = x.cost && x.price > 0 ? Math.max(0, Math.min(1, (x.price - x.cost) / x.price)) : 0.5
  const D = Math.min(1, x.units / 20)
  const C = x.sizesAll > 0 ? x.sizesIn / x.sizesAll : 1
  const N = x.fresh ? 1 : 0
  const total = w.sales + w.margin + w.depth + w.sizes + w.fresh + w.season || 1
  const score = (w.sales * S + w.margin * M + w.depth * D + w.sizes * C + w.fresh * N + w.season * x.season) / total
  // Запас в неделях: остаток ÷ продажи в неделю
  const perWeek = x.q30 / (30 / 7)
  const weeks = perWeek > 0 ? x.units / perWeek : null
  let role: Role = "base"
  if (x.outlet) role = "sale"
  else if (x.fresh) role = "new"
  else if (x.season < 0.3) role = "offseason"
  // Без продаж магазина «хит» и «второй шанс» не определить
  else if (!hasRetail) role = "base"
  else if (x.q30 > 0 && x.q30 >= hitLine) role = C < 0.5 ? "hit_broken" : "hit"
  else if (x.q60 <= 1 && x.units >= 3 && x.season >= 0.5) role = "second_chance"
  return { score: Math.round(score * 10000) / 10000, role, weeks: weeks === null ? null : Math.round(weeks * 10) / 10 }
}

/** Порог «хита»: продажи за 30 дней у верхних 20 % продающихся товаров */
export function hitLine(q30s: number[]): number {
  const sold = q30s.filter((q) => q > 0).sort((a, b) => b - a)
  if (!sold.length) return Infinity
  return sold[Math.max(0, Math.ceil(sold.length * 0.2) - 1)]
}
