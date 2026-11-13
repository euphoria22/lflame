/**
 * Оценка посылки для расчёта доставки (ТЗ, п. 5.2).
 * Если у варианта или товара заполнены вес/габариты — берутся они.
 * Иначе — значения «по умолчанию» из админки («Доставка и оплата» → «Габариты по умолчанию»):
 * вес по ключевым словам в названии и коробка заданного размера.
 */
type Dims = { weight?: number | null; length?: number | null; width?: number | null; height?: number | null }

export type ParcelItem = {
  title?: string | null
  product_title?: string | null
  quantity: number
  variant?: (Dims & { product?: Dims | null }) | null
}

export type Parcel = { weight: number; length: number; width: number; height: number }

/** Правило по названию товара: вес и габариты одной вещи в упаковке (см); габариты не заданы — коробка по умолчанию */
export type WeightRule = { keywords: string; weight: number; length?: number | null; width?: number | null; height?: number | null }

export type ParcelConfig = {
  /** Коробка по умолчанию, см */
  box_length: number
  box_width: number
  /** Высота коробки растёт с числом вещей: столько см на вещь, в пределах min–max */
  height_per_item: number
  min_height: number
  max_height: number
  /** Вес, если ни одно правило не подошло, г */
  fallback_weight: number
  /** Вес и габариты по словам в названии (через запятую, начало слова), г и см — с упаковкой */
  weights: WeightRule[]
}

export const DEFAULT_PARCEL: ParcelConfig = {
  box_length: 35,
  box_width: 25,
  height_per_item: 5,
  min_height: 10,
  max_height: 60,
  fallback_weight: 700,
  weights: [
    { keywords: "пуховик, парка, пальто, дублёнк, дубленк", weight: 2000, length: 60, width: 40, height: 20 },
    { keywords: "куртк, бомбер, ветровк, жилет, анорак", weight: 1300, length: 50, width: 35, height: 12 },
    { keywords: "кроссовк, кед, ботин, сапог, туфл, лофер, сандал, шлёп, шлеп, эспадрил, обув", weight: 1500, length: 35, width: 25, height: 15 },
    { keywords: "худи, свитшот, свитер, кардиган, толстовк, лонгслив", weight: 700, length: 35, width: 25, height: 8 },
    { keywords: "джинс, брюк, штан, джоггер", weight: 800, length: 35, width: 25, height: 6 },
    { keywords: "рубашк, поло, футболк, майк, топ", weight: 350, length: 30, width: 25, height: 5 },
    { keywords: "шорт", weight: 400, length: 30, width: 25, height: 4 },
    { keywords: "рюкзак, сумк", weight: 900, length: 45, width: 35, height: 15 },
    { keywords: "шапк, кепк, бейсболк, панам, балаклав, шарф, перчат, носк, трус, ремен, ремн, кошел, картхолдер", weight: 250, length: 25, width: 20, height: 5 },
  ],
}

const words = (s: string) => s.toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/i).filter(Boolean)

/** Значение варианта, иначе товара (> 0), иначе null. */
function own(item: ParcelItem, key: keyof Dims): number | null {
  const v = Number(item.variant?.[key] ?? 0) || Number(item.variant?.product?.[key] ?? 0)
  return v > 0 ? v : null
}

/** Первое правило, под которое подходит название товара */
export function itemRule(item: ParcelItem, cfg: ParcelConfig = DEFAULT_PARCEL): WeightRule | null {
  const title = words(`${item.product_title ?? ""} ${item.title ?? ""}`)
  for (const rule of cfg.weights) {
    const keys = rule.keywords.split(",").map((k) => k.trim().toLowerCase().replace(/ё/g, "е")).filter(Boolean)
    if (keys.some((k) => title.some((t) => t.startsWith(k)))) return rule
  }
  return null
}

export function itemWeight(item: ParcelItem, cfg: ParcelConfig = DEFAULT_PARCEL): number {
  return own(item, "weight") ?? itemRule(item, cfg)?.weight ?? cfg.fallback_weight
}

/** Габариты одной вещи: заполненные у варианта/товара → из правила по названию → коробка по умолчанию */
export function itemDims(item: ParcelItem, cfg: ParcelConfig = DEFAULT_PARCEL): { length: number; width: number; height: number } {
  const rule = itemRule(item, cfg)
  const pick = (k: "length" | "width" | "height", def: number) => own(item, k) ?? (Number(rule?.[k]) > 0 ? Number(rule![k]) : def)
  return { length: pick("length", cfg.box_length), width: pick("width", cfg.box_width), height: pick("height", cfg.height_per_item) }
}

/** Сохранённые правила без габаритов (настроены до их появления) — габариты из стандартного правила с теми же словами */
export function withDefaultDims(rules: WeightRule[]): WeightRule[] {
  return rules.map((r) => {
    if (r.length || r.width || r.height) return r
    const d = DEFAULT_PARCEL.weights.find((x) => x.keywords === r.keywords.trim())
    return d ? { ...r, length: d.length, width: d.width, height: d.height } : r
  })
}

/**
 * Одна коробка: вещи кладутся стопкой. Длина и ширина — по самой большой вещи, высота — сумма высот
 * (в пределах мин–макс). Габариты вещи: у товара → по правилу названия → коробка по умолчанию.
 * Пуховик 60×40×20 + футболка 30×25×5 = 60×40×25.
 */
export function estimateParcel(items: ParcelItem[], cfg: ParcelConfig = DEFAULT_PARCEL): Parcel {
  let length = 0
  let width = 0
  let height = 0
  let weight = 0
  for (const i of items) {
    const q = i.quantity || 1
    weight += itemWeight(i, cfg) * q
    // Длинная сторона — длина: 25×35 и 35×25 — одна и та же вещь
    const d = itemDims(i, cfg)
    const [l, w] = d.length >= d.width ? [d.length, d.width] : [d.width, d.length]
    length = Math.max(length, l)
    width = Math.max(width, w)
    height += d.height * q
  }
  return {
    weight: Math.round(weight || cfg.fallback_weight),
    length: Math.round(length || cfg.box_length),
    width: Math.round(width || cfg.box_width),
    height: Math.round(Math.min(cfg.max_height, Math.max(cfg.min_height, height || cfg.height_per_item))),
  }
}

/** Проверка настроек из админки. */
export function validateParcelConfig(input: Partial<ParcelConfig>): { value?: ParcelConfig; error?: string } {
  const c = { ...DEFAULT_PARCEL, ...input }
  const nums: [keyof ParcelConfig, string, number, number][] = [
    ["box_length", "Длина коробки", 1, 150],
    ["box_width", "Ширина коробки", 1, 150],
    ["height_per_item", "Высота на вещь", 1, 100],
    ["min_height", "Мин. высота", 1, 150],
    ["max_height", "Макс. высота", 1, 150],
    ["fallback_weight", "Вес по умолчанию", 10, 30000],
  ]
  const out = { ...c } as ParcelConfig
  for (const [k, label, min, max] of nums) {
    const n = Number(c[k])
    if (!Number.isFinite(n) || n < min || n > max) return { error: `${label}: от ${min} до ${max}` }
    ;(out[k] as number) = Math.round(n)
  }
  if (out.min_height > out.max_height) return { error: "Мин. высота больше максимальной" }
  if (!Array.isArray(c.weights)) return { error: "Правила веса: неверный формат" }
  const dim = (v: unknown) => (v === null || v === undefined || v === "" || Number(v) === 0 ? null : Math.round(Number(v)))
  out.weights = c.weights
    .map((r) => ({ keywords: String(r.keywords ?? "").trim(), weight: Math.round(Number(r.weight)), length: dim(r.length), width: dim(r.width), height: dim(r.height) }))
    .filter((r) => r.keywords)
  if (out.weights.some((r) => !Number.isFinite(r.weight) || r.weight < 10 || r.weight > 30000)) return { error: "Вес в правилах: от 10 до 30 000 г" }
  if (out.weights.some((r) => [r.length, r.width, r.height].some((x) => x != null && (!Number.isFinite(x) || x < 1 || x > 150)))) return { error: "Габариты в правилах: от 1 до 150 см" }
  return { value: out }
}
