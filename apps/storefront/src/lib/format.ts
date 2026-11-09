/** "5490" -> "5 490 ₽" (неразрывные пробелы). */
export function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(value))} ₽`
}

export function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null
  return Math.round((1 - price / compareAt) * 100)
}

/** Склонение: plural(3, ["товар", "товара", "товаров"]) -> "товара". */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

/**
 * Название без бренда для карточки: бренд выводится отдельной строкой.
 * "Шапка Tommy Jeans Badge Beanie Navy" + "Tommy Jeans" -> "Шапка Badge Beanie Navy".
 */
export function titleWithoutBrand(title: string, brand: string | null | undefined): string {
  if (!brand) return title
  const i = title.toLowerCase().indexOf(brand.toLowerCase())
  if (i < 0) return title
  return `${title.slice(0, i)}${title.slice(i + brand.length)}`.replace(/\s+/g, " ").trim()
}

/**
 * Дата поступления предзаказа: "2026-12-15" -> "15 декабря"; пустая — null.
 * Без сравнения с сегодняшним днём: страницы кэшируются, текущая дата здесь недоступна.
 */
export function arrivalDate(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}
