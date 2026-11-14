/**
 * Настройки умной сортировки каталога (ТЗ «Умная сортировка каталога Laflamme»).
 * Все числа — настройки: меняются в админке («Сортировка» → «Настройки») без выкладки кода,
 * каждая правка — новая версия с автором и откатом. Здесь — стартовые значения и проверка.
 */

export type Season = "winter" | "spring" | "summer" | "autumn"
export const SEASONS: Season[] = ["winter", "spring", "summer", "autumn"]
export const SEASON_NAMES: Record<Season, string> = { winter: "Зима", spring: "Весна", summer: "Лето", autumn: "Осень" }

export type Zone = "central" | "cold" | "south"
export const ZONES: Zone[] = ["central", "cold", "south"]
export const ZONE_NAMES: Record<Zone, string> = { central: "Центральная", cold: "Холодная", south: "Южная" }

export type ProfileKey = "base" | "launch" | "season_start" | "season_end"
export const PROFILE_NAMES: Record<ProfileKey, string> = { base: "Базовый", launch: "Запуск", season_start: "Начало сезона", season_end: "Конец сезона" }
export type Weights = { N: number; S: number; I: number; R: number; Z: number; M: number }
export const COMPONENTS = ["N", "S", "I", "R", "Z", "M"] as const
export const COMPONENT_NAMES: Record<keyof Weights, string> = { N: "Новизна", S: "Продажи", I: "Интерес", R: "Размеры", Z: "Сезон", M: "Маржа" }

/** Строки матрицы сезонности (16 категорий раздела 4) */
export const MATRIX_ROWS = [
  "puffers", "light_jackets", "vests", "knitwear", "hoodies", "longsleeves", "tees", "shirts",
  "pants", "shorts", "winter_hats", "caps", "winter_shoes", "sneakers", "sandals", "accessories",
] as const
export type MatrixRow = (typeof MATRIX_ROWS)[number]
export const MATRIX_NAMES: Record<MatrixRow, string> = {
  puffers: "Пуховики, парки", light_jackets: "Лёгкие куртки, ветровки", vests: "Жилеты", knitwear: "Свитеры, трикотаж",
  hoodies: "Худи, свитшоты", longsleeves: "Лонгсливы", tees: "Футболки, поло", shirts: "Рубашки", pants: "Джинсы, брюки",
  shorts: "Шорты, плавки", winter_hats: "Шапки, шарфы, перчатки", caps: "Кепки, панамы", winter_shoes: "Зимняя обувь",
  sneakers: "Кроссовки", sandals: "Сланцы, сандалии", accessories: "Сумки, бельё, носки, аксессуары",
}
export type Warmth = "warm" | "demi" | "light"
export const WARMTH_NAMES: Record<Warmth, string> = { warm: "Утеплённая", demi: "Демисезон", light: "Лёгкая" }

type SeasonRow = Record<Season, number>
const row = (winter: number, spring: number, summer: number, autumn: number): SeasonRow => ({ winter, spring, summer, autumn })

export type SortConfig = {
  /** Активный профиль весов; auto — по правилам «когда включать» */
  profile: ProfileKey | "auto"
  profiles: Record<ProfileKey, Weights>
  /** Новизна: exp(-d / novelty_days) */
  novelty_days: number
  /** Интерес: вес корзины и константа сглаживания (показов) */
  atc_weight: number
  smoothing: number
  /** Маржа: доля нормированной маржи и приоритета бренда */
  margin_weight: number
  brand_weight: number
  /** Приоритет бренда 0–1 по адресу бренда; нет в списке — 0.5 */
  brand_priority: Record<string, number>
  multipliers: {
    one_size: number; one_size_min_grid: number
    preorder: number
    overstock: number; overstock_days: number; overstock_min_age: number
    sale_cap: number
  }
  /** Календарь спроса: начало сезона, [месяц, день] */
  calendar: Record<Season, [number, number]>
  /** Плавный переход на границе сезонов, дней */
  blend_days: number
  /** Сдвиг границ по зонам, дней: cold_season — осень и зима, warm_season — весна и лето (минус — раньше) */
  zones: Record<Zone, { cold_season: number; warm_season: number }>
  matrix: Record<MatrixRow, SeasonRow>
  warmth: Record<Warmth, SeasonRow>
  collection: { current: number; none: number; previous: number; opposite: number }
  /** Недель от начала и до конца сезона для профилей «Начало сезона» и «Конец сезона» */
  season_edge_weeks: number
  /** Профиль «Запуск», пока статистики показов меньше стольких дней */
  launch_days: number
  /** Разведение соседей: штрафы и окна */
  penalties: { brand: number; color: number; category: number; price: number }
  windows: { brand: number; color: number; category: number; price: number }
  limits: {
    brand_run: number; brand_window: number; brand_in_window: number
    color_run: number; black_window: number; black_in_window: number
    price_run: number
    model_gap: number
  }
  /** Сколько лучших по баллу карточек рассматривать на каждую позицию */
  candidates: number
  /** Квота для карточек без статистики: каждая N-я позиция до позиции last, порог показов */
  quota: { every: number; last: number; max_impressions: number }
  /** Доля размеров в продажах по группам товаров: top (верх), bottom (низ), shoes (обувь) */
  size_demand: Record<string, Record<string, number>>
  /** Новый балл записывается, если отличается больше чем на столько (доля) */
  write_threshold: number
}

export const DEFAULT_CONFIG: SortConfig = {
  profile: "auto",
  profiles: {
    base: { N: 0.25, S: 0.2, I: 0.15, R: 0.15, Z: 0.15, M: 0.1 },
    launch: { N: 0.35, S: 0.25, I: 0, R: 0.15, Z: 0.15, M: 0.1 },
    season_start: { N: 0.35, S: 0.15, I: 0.15, R: 0.15, Z: 0.15, M: 0.05 },
    season_end: { N: 0.15, S: 0.25, I: 0.15, R: 0.2, Z: 0.1, M: 0.15 },
  },
  novelty_days: 30,
  atc_weight: 1.5,
  smoothing: 100,
  margin_weight: 0.7,
  brand_weight: 0.3,
  brand_priority: {},
  multipliers: { one_size: 0.5, one_size_min_grid: 3, preorder: 0.7, overstock: 1.15, overstock_days: 90, overstock_min_age: 30, sale_cap: 1.5 },
  calendar: { winter: [11, 1], spring: [2, 21], summer: [5, 1], autumn: [8, 16] },
  blend_days: 21,
  zones: { central: { cold_season: 0, warm_season: 0 }, cold: { cold_season: -14, warm_season: 14 }, south: { cold_season: 21, warm_season: -21 } },
  matrix: {
    puffers: row(1, 0.3, 0.1, 0.8), light_jackets: row(0.2, 1, 0.5, 1), vests: row(0.5, 0.9, 0.3, 1), knitwear: row(1, 0.6, 0.15, 0.9),
    hoodies: row(0.9, 1, 0.5, 1), longsleeves: row(0.7, 0.9, 0.5, 0.9), tees: row(0.4, 0.8, 1, 0.6), shirts: row(0.5, 0.8, 0.8, 0.7),
    pants: row(0.8, 0.9, 0.7, 0.9), shorts: row(0.1, 0.5, 1, 0.2), winter_hats: row(1, 0.3, 0.1, 0.8), caps: row(0.2, 0.8, 1, 0.6),
    winter_shoes: row(1, 0.3, 0.1, 0.7), sneakers: row(0.4, 1, 1, 0.8), sandals: row(0.1, 0.4, 1, 0.2), accessories: row(0.7, 0.7, 0.7, 0.7),
  },
  warmth: { warm: row(1, 0.3, 0.1, 0.8), demi: row(0.3, 1, 0.4, 1), light: row(0.1, 0.7, 1, 0.5) },
  collection: { current: 1, none: 0.9, previous: 0.85, opposite: 0.6 },
  season_edge_weeks: 6,
  launch_days: 14,
  penalties: { brand: 0.6, color: 0.75, category: 0.85, price: 0.9 },
  windows: { brand: 4, color: 4, category: 3, price: 3 },
  limits: { brand_run: 2, brand_window: 12, brand_in_window: 4, color_run: 2, black_window: 8, black_in_window: 4, price_run: 3, model_gap: 8 },
  candidates: 50,
  quota: { every: 6, last: 48, max_impressions: 200 },
  size_demand: { top: { XS: 0.05, S: 0.2, M: 0.3, L: 0.25, XL: 0.15, XXL: 0.05 } },
  write_threshold: 0.05,
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

/** Наложить сохранённые настройки на стартовые: новых полей в старой версии может не быть */
export function mergeConfig(raw: unknown, base: SortConfig = DEFAULT_CONFIG): SortConfig {
  const merge = (b: unknown, r: unknown): unknown => {
    if (Array.isArray(b)) return Array.isArray(r) && r.length === b.length && r.every(isNum) ? r : b
    if (b && typeof b === "object") {
      const ro = r && typeof r === "object" && !Array.isArray(r) ? (r as Record<string, unknown>) : {}
      const bo = b as Record<string, unknown>
      // Словари без фиксированных ключей (приоритеты брендов, спрос по размерам) берём из сохранённого целиком
      const keys = Object.keys(bo)
      const out: Record<string, unknown> = {}
      for (const k of keys) out[k] = merge(bo[k], ro[k])
      return out
    }
    if (typeof b === "number") return isNum(r) ? r : b
    return typeof r === typeof b ? r : b
  }
  const out = merge(base, raw) as SortConfig
  const r = (raw ?? {}) as Partial<SortConfig>
  if (r.brand_priority && typeof r.brand_priority === "object") out.brand_priority = Object.fromEntries(Object.entries(r.brand_priority).filter(([, v]) => isNum(v)))
  if (r.size_demand && typeof r.size_demand === "object") {
    out.size_demand = Object.fromEntries(Object.entries(r.size_demand).map(([g, t]) => [g, Object.fromEntries(Object.entries(t ?? {}).filter(([, v]) => isNum(v)))]))
  }
  if (r.profile && (r.profile === "auto" || r.profile in base.profiles)) out.profile = r.profile
  return out
}

/** Проверка настроек перед сохранением; ошибка — человеческим языком */
export function validateConfig(raw: unknown): { value?: SortConfig; error?: string } {
  const c = mergeConfig(raw)
  for (const [k, w] of Object.entries(c.profiles)) {
    const sum = COMPONENTS.reduce((a, x) => a + w[x], 0)
    if (COMPONENTS.some((x) => w[x] < 0 || w[x] > 1)) return { error: `Профиль «${PROFILE_NAMES[k as ProfileKey]}»: веса должны быть от 0 до 1` }
    if (Math.abs(sum - 1) > 0.001) return { error: `Профиль «${PROFILE_NAMES[k as ProfileKey]}»: сумма весов ${sum.toFixed(2)}, а должна быть 1` }
  }
  const in01 = (v: number) => v >= 0 && v <= 1
  for (const r of MATRIX_ROWS) if (!SEASONS.every((s) => in01(c.matrix[r][s]))) return { error: `Матрица сезонности, «${MATRIX_NAMES[r]}»: значения от 0 до 1` }
  for (const r of Object.keys(c.warmth) as Warmth[]) if (!SEASONS.every((s) => in01(c.warmth[r][s]))) return { error: `Утеплённость, «${WARMTH_NAMES[r]}»: значения от 0 до 1` }
  for (const s of SEASONS) {
    const [m, d] = c.calendar[s]
    if (!(Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(d) && d >= 1 && d <= 31)) return { error: `Календарь: неверная дата начала сезона «${SEASON_NAMES[s]}»` }
  }
  if (Object.values(c.penalties).some((v) => v <= 0 || v > 1)) return { error: "Штрафы разведения: от 0 до 1" }
  if (Object.values(c.windows).some((v) => !Number.isInteger(v) || v < 0 || v > 24)) return { error: "Окна разведения: целые числа от 0 до 24" }
  if (Object.values(c.limits).some((v) => !Number.isInteger(v) || v < 1 || v > 48)) return { error: "Лимиты разведения: целые числа от 1 до 48" }
  if (!Number.isInteger(c.candidates) || c.candidates < 5 || c.candidates > 500) return { error: "Кандидатов на позицию: от 5 до 500" }
  if (c.novelty_days <= 0 || c.smoothing < 0 || c.blend_days < 0) return { error: "Новизна, сглаживание и переход: положительные числа" }
  if (Object.values(c.brand_priority).some((v) => !in01(v))) return { error: "Приоритет бренда: от 0 до 1" }
  if (c.multipliers.sale_cap < 1 || c.multipliers.one_size <= 0 || c.multipliers.preorder <= 0 || c.multipliers.overstock <= 0) return { error: "Множители: положительные числа, предел распродажи не меньше 1" }
  if (!Number.isInteger(c.quota.every) || c.quota.every < 2 || c.quota.last < 0) return { error: "Квота: шаг — целое от 2" }
  return { value: c }
}
