import { fixLatinLookalikes, slugify } from "./translit"

/**
 * Бренды (ТЗ, п. 2.2). Бренд определяется по полю «Бренд» в МоемСкладе,
 * а если оно пустое — по названию товара. Справочник хранится в модуле brand;
 * BRAND_SEED — стартовое наполнение, собранное по каталогу LAFLAMME (08.11.2026).
 * Новые бренды и написания (aliases) сотрудник добавляет в админке.
 */
export type BrandSeed = {
  name: string
  handle?: string
  aliases?: string[]
}

export const BRAND_SEED: BrandSeed[] = [
  { name: "Calvin Klein Jeans" },
  { name: "Calvin Klein" },
  { name: "Tommy Hilfiger" },
  { name: "Tommy Jeans" },
  { name: "C.P. Company", handle: "cp-company", aliases: ["C.P Company", "CP Company", "C.P.Company", "C.P."] },
  { name: "Carhartt WIP" },
  { name: "Carhartt" },
  { name: "Yeezy Gap", aliases: ["Yeezy x Gap"] },
  { name: "Yeezy" },
  { name: "MISBHV", handle: "misbhv" },
  { name: "Diesel" },
  { name: "Stone Island" },
  { name: "Travis Scott", aliases: ["Cactus Jack", "Travis Scott Cactus Jack", "Cactus Jack Travis Scott"] },
  { name: "Polo Ralph Lauren" },
  { name: "Lauren Ralph Lauren" },
  { name: "Stussy", aliases: ["Stüssy"] },
  { name: "Armani Exchange" },
  { name: "Emporio Armani" },
  { name: "Oakley" },
  { name: "Fucking Awesome", handle: "fucking-awesome", aliases: ["F*cking Awesome", "F*ckingAwesome"] },
  { name: "Market", aliases: ["Chinatown Market", "ChinaTown Market"] },
  { name: "New Balance" },
  { name: "HUF", handle: "huf" },
  { name: "AVAVAV", handle: "avavav" },
  { name: "Nike" },
  { name: "Pleasures" },
  { name: "UGG", handle: "ugg", aliases: ["Ugg"] },
  { name: "Palace" },
  { name: "Fear of God Essentials", aliases: ["Fear Of God Essentials", "Fear of God", "FOG Essentials"] },
  { name: "Undefeated" },
  { name: "Alpha Industries" },
  { name: "Salomon" },
  { name: "Dr. Martens", handle: "dr-martens", aliases: ["Dr.Martens", "Dr Martens"] },
  { name: "Converse" },
  { name: "Champion" },
  { name: "Fred Perry" },
  { name: "Maison Margiela", aliases: ["Masion Margeila", "Maison Margeila"] },
  { name: "Juicy Couture" },
  { name: "On Running", aliases: ["On Cloud"] },
  { name: "Foot Industry" },
  { name: "The North Face", aliases: ["TNF"] },
  { name: "A-COLD-WALL*", handle: "a-cold-wall", aliases: ["A-COLD-WALL", "A Cold Wall"] },
  { name: "Dime" },
  { name: "Timberland" },
  { name: "Levi's", handle: "levis", aliases: ["Levis"] },
  { name: "MSGM", handle: "msgm" },
  { name: "Puma" },
  { name: "Lacoste" },
]

export type BrandMatcher = {
  /** id бренда в базе или handle для ещё не созданного */
  key: string
  name: string
  aliases: string[]
}

export function brandHandle(seed: BrandSeed): string {
  return seed.handle ?? slugify(seed.name)
}

function normalize(text: string): string {
  return ` ${fixLatinLookalikes(text)
    .toLowerCase()
    .replace(/[“”"«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Находит бренд по тексту. Побеждает самое длинное совпадение:
 * "Calvin Klein Jeans" важнее "Calvin Klein", "Yeezy x Gap" важнее "Yeezy".
 * Возвращает бренд и найденное написание (чтобы вырезать его из названия перед поиском цвета).
 */
export function matchBrand(
  text: string,
  brands: BrandMatcher[]
): { brand: BrandMatcher; alias: string } | null {
  const hay = normalize(text)
  let best: { brand: BrandMatcher; alias: string } | null = null

  for (const brand of brands) {
    for (const alias of [brand.name, ...brand.aliases]) {
      const needle = normalize(alias).trim()
      if (!needle) continue
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}($|[^a-z0-9])`)
      if (re.test(hay) && (!best || needle.length > best.alias.length)) {
        best = { brand, alias: needle }
      }
    }
  }
  return best
}

/** Бренд товара: сначала поле МС «Бренд», затем название. */
export function detectBrand(
  productName: string,
  moyskladBrand: string | null | undefined,
  brands: BrandMatcher[]
): { brand: BrandMatcher; alias: string } | null {
  if (moyskladBrand && moyskladBrand.trim()) {
    const byField = matchBrand(moyskladBrand, brands)
    if (byField) {
      // Если в названии найдено более точное написание того же бренда — берём его для вырезания
      const byName = matchBrand(productName, brands)
      return byName && byName.brand.key === byField.brand.key ? byName : byField
    }
  }
  return matchBrand(productName, brands)
}

export function seedMatchers(): BrandMatcher[] {
  return BRAND_SEED.map((b) => ({ key: brandHandle(b), name: b.name, aliases: b.aliases ?? [] }))
}
