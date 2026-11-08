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

export type WeightRule = { keywords: string; weight: number }

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
  /** Вес по словам в названии (через запятую, начало слова), г — с упаковкой */
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
    { keywords: "пуховик, парка, пальто, дублёнк, дубленк", weight: 2000 },
    { keywords: "куртк, бомбер, ветровк, жилет, анорак", weight: 1300 },
    { keywords: "кроссовк, кед, ботин, сапог, туфл, лофер, сандал, шлёп, шлеп, эспадрил, обув", weight: 1500 },
    { keywords: "худи, свитшот, свитер, кардиган, толстовк, лонгслив", weight: 700 },
    { keywords: "джинс, брюк, штан, джоггер", weight: 800 },
    { keywords: "рубашк, поло, футболк, майк, топ", weight: 350 },
    { keywords: "шорт", weight: 400 },
    { keywords: "рюкзак, сумк", weight: 900 },
    { keywords: "шапк, кепк, бейсболк, панам, балаклав, шарф, перчат, носк, трус, ремен, ремн, кошел, картхолдер", weight: 250 },
  ],
}

const words = (s: string) => s.toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/i).filter(Boolean)

/** Значение варианта, иначе товара (> 0), иначе null. */
function own(item: ParcelItem, key: keyof Dims): number | null {
  const v = Number(item.variant?.[key] ?? 0) || Number(item.variant?.product?.[key] ?? 0)
  return v > 0 ? v : null
}

export function itemWeight(item: ParcelItem, cfg: ParcelConfig = DEFAULT_PARCEL): number {
  const w = own(item, "weight")
  if (w) return w
  const title = words(`${item.product_title ?? ""} ${item.title ?? ""}`)
  for (const rule of cfg.weights) {
    const keys = rule.keywords.split(",").map((k) => k.trim().toLowerCase().replace(/ё/g, "е")).filter(Boolean)
    if (keys.some((k) => title.some((t) => t.startsWith(k)))) return rule.weight
  }
  return cfg.fallback_weight
}

/**
 * Одна коробка. Длина и ширина — наибольшие из заполненных у товаров (не меньше коробки по умолчанию);
 * высота — сумма высот: заполненная у товара или «см на вещь» по умолчанию.
 */
export function estimateParcel(items: ParcelItem[], cfg: ParcelConfig = DEFAULT_PARCEL): Parcel {
  let length = cfg.box_length
  let width = cfg.box_width
  let height = 0
  let weight = 0
  for (const i of items) {
    const q = i.quantity || 1
    weight += itemWeight(i, cfg) * q
    const [l, w, h] = [own(i, "length"), own(i, "width"), own(i, "height")]
    if (l) length = Math.max(length, l)
    if (w) width = Math.max(width, w)
    height += (h ?? cfg.height_per_item) * q
  }
  return {
    weight: Math.round(weight || cfg.fallback_weight),
    length: Math.round(length),
    width: Math.round(width),
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
  out.weights = c.weights
    .map((r) => ({ keywords: String(r.keywords ?? "").trim(), weight: Math.round(Number(r.weight)) }))
    .filter((r) => r.keywords)
  if (out.weights.some((r) => !Number.isFinite(r.weight) || r.weight < 10 || r.weight > 30000)) return { error: "Вес в правилах: от 10 до 30 000 г" }
  return { value: out }
}
