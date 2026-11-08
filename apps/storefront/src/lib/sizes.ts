// Копия apps/backend/src/lib/catalog/sizes.ts: витрине нужна та же сортировка размеров.
import { fixLatinLookalikes } from "./translit"

/**
 * Нормализация размеров из МоегоСклада (ТЗ, п. 2.1).
 * В МС встречаются "One Size" и "One size", латинская M и русская М,
 * "32x32" и "32х32", "42 EU" и "42 EUR", "42,5 EUR".
 */
const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]

export function normalizeSize(raw: string): string {
  let s = fixLatinLookalikes(String(raw ?? "").trim()).replace(/\s+/g, " ")
  if (!s) {
    return "One Size"
  }

  // Русская «М» отдельным словом
  s = s.replace(/^М$/u, "M")

  if (/^(one\s*size|os|onesize|единый|универсальный)$/i.test(s)) {
    return "One Size"
  }

  // Обувь: "42 EUR", "42EU", "42,5 EUR", "41 1/3 EUR" -> "42 EU", "42.5 EU", "41 1/3 EU"
  const eu = s.match(/^(\d{2}(?:[.,]\d)?(?:\s+\d\/\d)?)\s*(?:eur?|eu)$/i)
  if (eu) {
    return `${eu[1].replace(",", ".")} EU`
  }

  // Джинсы: "32х32", "32 x 32", "25xRL" -> "32x32", "25xRL"
  const waist = s.match(/^(\d{2})\s*[xх×]\s*(\d{2}|[A-Za-z]{1,3})$/i)
  if (waist) {
    return `${waist[1]}x${waist[2].toUpperCase()}`
  }

  // Буквенные: "xl" -> "XL", "S/M", "M-L" -> "M/L", "L / XL" -> "L/XL"
  const letters = s.toUpperCase().replace(/\s*[/-]\s*/g, "/")
  if (letters.split("/").every((p) => LETTER_SIZES.includes(p))) {
    return letters
  }

  // Российский с буквенным: "48 (M)", "52 (L-XL)" -> "48 (M)", "52 (L/XL)"
  const ru = s.match(/^(\d{2})\s*\(\s*([A-Za-z/ -]+)\s*\)$/)
  if (ru) {
    return `${ru[1]} (${ru[2].toUpperCase().replace(/\s*[/-]\s*/g, "/")})`
  }

  return s
}

/** Порядок сортировки размеров на витрине: XXS..XXXXL, затем числовые, One Size — в конце. */
export function sizeRank(size: string): number {
  if (size === "One Size") {
    return 100000
  }
  const first = size.split("/")[0]
  const letter = LETTER_SIZES.indexOf(first)
  if (letter >= 0) {
    return letter * 10 + (size.includes("/") ? 5 : 0)
  }
  const num = parseFloat(size.replace(",", "."))
  if (!Number.isNaN(num)) {
    const inseam = size.match(/x(\d{2})$/)
    return 1000 + num * 100 + (inseam ? Number(inseam[1]) : 0)
  }
  return 50000
}

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b))
}
