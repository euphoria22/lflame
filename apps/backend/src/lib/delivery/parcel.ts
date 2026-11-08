/**
 * Оценка посылки для расчёта доставки (ТЗ, п. 5.2).
 * Вес и габариты в МоемСкладе пока не заполнены, поэтому используется вес по умолчанию
 * по типу товара (первое слово названия). Если у варианта есть вес (граммы) — берётся он.
 */
export type ParcelItem = { title?: string | null; product_title?: string | null; quantity: number; variant?: { weight?: number | null } | null }

export type Parcel = { weight: number; length: number; width: number; height: number }

/** Вес по умолчанию, граммы (с упаковкой). */
const DEFAULT_WEIGHTS: [RegExp, number][] = [
  [/пуховик|парка|пальто|дубл[её]нк/i, 2000],
  [/куртк|бомбер|ветровк|жилет|анорак/i, 1300],
  [/кроссовк|кед|ботин|сапог|туфл|лофер|сандал|шлёп|шлеп|эспадрил|обув/i, 1500],
  [/худи|свитшот|свитер|кардиган|толстовк|лонгслив/i, 700],
  [/джинс|брюк|штан|джоггер/i, 800],
  [/рубашк|поло|футболк|майк|топ/i, 350],
  [/шорт/i, 400],
  [/рюкзак|сумк/i, 900],
  [/шапк|кепк|бейсболк|панам|балаклав|шарф|перчат|носк|трус|ремен|ремн|кошел|картхолдер|пин/i, 250],
]
const FALLBACK_WEIGHT = 700

export function itemWeight(item: ParcelItem): number {
  const w = Number(item.variant?.weight ?? 0)
  if (w > 0) return w
  const title = `${item.product_title ?? ""} ${item.title ?? ""}`
  return DEFAULT_WEIGHTS.find(([re]) => re.test(title))?.[1] ?? FALLBACK_WEIGHT
}

/** Одна коробка 35×25 см, высота растёт с количеством вещей (5 см на вещь, 10–60 см). */
export function estimateParcel(items: ParcelItem[]): Parcel {
  const count = items.reduce((s, i) => s + (i.quantity || 1), 0) || 1
  const weight = items.reduce((s, i) => s + itemWeight(i) * (i.quantity || 1), 0) || FALLBACK_WEIGHT
  return { weight: Math.round(weight), length: 35, width: 25, height: Math.min(60, Math.max(10, count * 5)) }
}
