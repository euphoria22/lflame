/**
 * Группы размеров для фильтра (решение по обратной связи 08.11.2026).
 * В МоемСкладе у одного «S» бывает несколько написаний: «S», «46 (S)», «S/M».
 * В фильтре показывается только буквенный размер, а товары с «46 (S)» находятся по «S».
 * Джинсы группируются по талии (W30), обувь — по EU-размеру с шагом 0,5.
 */
const LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]
const LETTER_LABEL: Record<string, string> = { XXXL: "3XL", XXXXL: "4XL" }

export type SizeKind = "letter" | "waist" | "shoe" | "other" | "one"

/** Ключи фильтра, к которым относится размер варианта. */
export function sizeKeys(size: string): string[] {
  const s = size.trim()
  if (/^one size/i.test(s)) return ["one-size"]

  // «46 (S)», «52 (L/XL)» -> буквы в скобках
  const paren = s.match(/\(([A-Z/]+)\)\s*$/i)
  const letterPart = paren ? paren[1] : s
  const letters = letterPart.toUpperCase().split("/")
  if (letters.every((l) => LETTERS.includes(l))) return letters

  // Джинсы: «30x32», «25xRL», а также просто «30» (талия)
  const waist = s.match(/^(\d{2})(?:x(?:\d{2}|[A-Z]{1,3}))?$/i)
  if (waist && Number(waist[1]) >= 22 && Number(waist[1]) <= 44) return [`W${waist[1]}`]

  // Обувь: «42.5 EU», «41 1/3 EU» -> ближайшие 0,5; «7US (EU 39.5)» -> 39.5
  const eu = s.match(/(?:EU\s*)?(\d{2}(?:\.\d)?)(?:\s+(\d)\/(\d))?\s*EU\)?$/i) ?? s.match(/\(EU\s*(\d{2}(?:\.\d)?)\)/i)
  if (eu) {
    let n = Number(eu[1])
    if (eu[2] && eu[3]) n += Number(eu[2]) / Number(eu[3])
    return [`EU${Math.round(n * 2) / 2}`]
  }
  return [`raw:${s}`]
}

export function sizeKind(key: string): SizeKind {
  if (key === "one-size") return "one"
  if (LETTERS.includes(key)) return "letter"
  if (key.startsWith("W")) return "waist"
  if (key.startsWith("EU")) return "shoe"
  return "other"
}

export function sizeLabel(key: string): string {
  if (key === "one-size") return "One Size"
  if (LETTERS.includes(key)) return LETTER_LABEL[key] ?? key
  if (key.startsWith("W")) return key
  if (key.startsWith("EU")) return `${key.slice(2)} EU`
  return key.replace(/^raw:/, "")
}

/** Порядок в фильтре: буквы, талия, обувь, прочее, One Size. */
export function sizeKeyRank(key: string): number {
  const kind = sizeKind(key)
  if (kind === "letter") return LETTERS.indexOf(key)
  if (kind === "waist") return 100 + Number(key.slice(1))
  if (kind === "shoe") return 1000 + Number(key.slice(2))
  if (kind === "one") return 100000
  return 50000
}
