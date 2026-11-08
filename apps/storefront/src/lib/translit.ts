/**
 * Транслитерация и slug для адресов страниц (ТЗ, п. 7.2).
 * Упрощённая схема, близкая к адресам старого сайта (hudi, svitshot, bryuki).
 */
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
}

export function translit(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => MAP[ch] ?? ch)
    .join("")
}

/**
 * slug: латиница в нижнем регистре, цифры и дефисы.
 * "C.P. Company" -> "cp-company", "Levi's" -> "levis", "A & B" -> "a-and-b".
 */
export function slugify(input: string, maxLength = 90): string {
  const base = translit(fixLatinLookalikes(input))
    .replace(/&/g, " and ")
    .replace(/['’`.*]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (base.length <= maxLength) {
    return base
  }
  const cut = base.slice(0, maxLength)
  const lastDash = cut.lastIndexOf("-")
  return (lastDash > maxLength / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, "")
}

/**
 * Кириллические буквы, похожие на латинские, внутри латинских слов
 * ("Сalvin Klein", "Cумки") заменяются латинскими. Русские слова не трогаются.
 */
const LOOKALIKES: Record<string, string> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X",
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y",
}

export function fixLatinLookalikes(input: string): string {
  return input.replace(/[\p{L}\p{N}'’.*&-]+/gu, (word) => {
    const latin = (word.match(/[A-Za-z]/g) || []).length
    const cyr = (word.match(/[Ѐ-ӿ]/g) || []).length
    if (latin === 0 || cyr === 0) {
      return word
    }
    // Слово в основном русское (например, «Cумки» с латинской C) — исправляем в обратную сторону
    if (cyr > latin) {
      return word.replace(/[A-Za-z]/g, (ch) => LATIN_TO_CYR[ch] ?? ch)
    }
    return word.replace(/[Ѐ-ӿ]/g, (ch) => LOOKALIKES[ch] ?? ch)
  })
}

const LATIN_TO_CYR: Record<string, string> = Object.fromEntries(
  Object.entries(LOOKALIKES).map(([cyr, lat]) => [lat, cyr])
)
