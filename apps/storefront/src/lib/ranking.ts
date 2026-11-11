import type { CatalogItem } from "./types"

/**
 * Сортировка «Популярные»: балл товара из продаж, полноты размеров, свежести, качества карточки,
 * скидки и сезона; закреплённые в админке — первыми. Считается внутри кэша каталога (там можно брать дату).
 */

type Season = { name: string; up: string[]; down: string[] }

/** Сезоны с поправкой на климат Омска: зима длинная. Категории — адреса разделов. */
const SEASONS: { months: number[]; season: Season }[] = [
  { months: [11, 12, 1, 2, 3], season: { name: "зима", up: ["kurtki", "svitery-i-kardigany", "hudi-i-svitshoty", "golovnye-ubory", "obuv", "bryuki"], down: ["shorty", "futbolki-i-longslivy", "rubashki-i-polo"] } },
  { months: [4, 5], season: { name: "весна", up: ["hudi-i-svitshoty", "kurtki", "bryuki", "dzhinsy", "obuv"], down: [] } },
  { months: [6, 7, 8], season: { name: "лето", up: ["futbolki-i-longslivy", "shorty", "rubashki-i-polo", "golovnye-ubory", "sumki-i-ryukzaki"], down: ["kurtki", "svitery-i-kardigany"] } },
  { months: [9, 10], season: { name: "осень", up: ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany", "bryuki", "dzhinsy", "obuv"], down: ["shorty"] } },
]

export function seasonFor(date: Date): Season {
  const m = date.getMonth() + 1
  return SEASONS.find((s) => s.months.includes(m))!.season
}

/** Веса сигналов. Продажи — главный: лучше всего предсказывают покупку. */
const W = { sales: 3, sizes: 1.5, fresh: 1.2, card: 0.8, discount: 0.3, season: 1, pinned: 100 }

export function rankItems<T extends CatalogItem>(items: T[], now: Date): (T & { rank: number })[] {
  const season = seasonFor(now)
  const maxSales = Math.max(0, ...items.map((i) => i.sales ?? 0))
  return items.map((i) => {
    const sales = maxSales ? Math.log1p(i.sales ?? 0) / Math.log1p(maxSales) : 0
    const sizes = i.sizes.length ? i.sizes.filter((s) => s.in_stock).length / i.sizes.length : 0
    const card = Math.min(i.images_count ?? 1, 4) / 4 * 0.7 + (i.has_description ? 0.3 : 0)
    const discount = i.compare_at ? Math.min(1 - i.price / i.compare_at, 0.5) / 0.5 : 0
    const cat = i.category?.handle ?? ""
    const inSeason = season.up.includes(cat) ? 1 : season.down.includes(cat) ? -1 : 0
    const rank = W.sales * sales + W.sizes * sizes + W.fresh * (i.is_new ? 1 : 0) + W.card * card
      + W.discount * discount + W.season * inSeason + (i.pinned ? W.pinned : 0)
    return { ...i, rank }
  })
}

/** Модель без цвета: бренд + первые латинские слова названия («Logo Tape Fleece» у худи всех цветов). */
export function modelKey(i: CatalogItem): string {
  const brand = (i.brand?.name ?? "").toLowerCase()
  const words = i.title.toLowerCase().replace(brand, " ").split(/[^a-z0-9]+/).filter(Boolean)
  return `${i.brand?.handle ?? ""}:${i.category?.handle ?? ""}:${words.slice(0, 3).join(" ")}`
}

/**
 * Раскладка ленты: по баллу, но одна модель в разных цветах не стоит рядом (не ближе 6 позиций),
 * а в первых рядах бренды чередуются. Берём лучший товар из ближайших 30, который подходит.
 */
export function diversify<T extends CatalogItem>(sorted: T[]): T[] {
  const rest = [...sorted]
  const out: T[] = []
  const LOOKAHEAD = 30
  const TOP = 48
  while (rest.length) {
    const recentModels = new Set(out.slice(-6).map(modelKey))
    const lastBrand = out[out.length - 1]?.brand?.handle
    let pick = 0
    for (let k = 0; k < Math.min(LOOKAHEAD, rest.length); k++) {
      const c = rest[k]
      if (c.pinned) { pick = k; break }
      const okModel = !recentModels.has(modelKey(c))
      const okBrand = out.length >= TOP || !lastBrand || c.brand?.handle !== lastBrand
      if (okModel && okBrand) { pick = k; break }
    }
    out.push(rest.splice(pick, 1)[0])
  }
  return out
}
