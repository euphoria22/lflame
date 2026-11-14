import type { CatalogItem } from "./types"

/**
 * Сортировка «Популярные»: балл товара из продаж товара и всего его раздела, остатка (много пришло — выше),
 * полноты размеров, свежести, скидки и сезона; закреплённые в админке — первыми. Количество фото не влияет.
 * Считается внутри кэша каталога (там можно брать дату).
 */

type Season = { name: string; up: string[]; down: string[] }

/**
 * Сезоны по средней полосе России (основные покупатели — по всей стране, не только Омск).
 * Ноябрь и март — переходные: тёплое уже/ещё наверху, летнее не опускаем. Категории — адреса разделов.
 */
const SEASONS: { months: number[]; season: Season }[] = [
  { months: [12, 1, 2], season: { name: "зима", up: ["kurtki", "svitery-i-kardigany", "hudi-i-svitshoty", "golovnye-ubory", "obuv", "bryuki"], down: ["shorty", "futbolki-i-longslivy", "rubashki-i-polo"] } },
  { months: [11, 3], season: { name: "межсезонье", up: ["kurtki", "svitery-i-kardigany", "hudi-i-svitshoty", "golovnye-ubory"], down: [] } },
  { months: [4, 5], season: { name: "весна", up: ["hudi-i-svitshoty", "kurtki", "bryuki", "dzhinsy", "obuv"], down: [] } },
  { months: [6, 7, 8], season: { name: "лето", up: ["futbolki-i-longslivy", "shorty", "rubashki-i-polo", "golovnye-ubory", "sumki-i-ryukzaki"], down: ["kurtki", "svitery-i-kardigany"] } },
  { months: [9, 10], season: { name: "осень", up: ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany", "bryuki", "dzhinsy", "obuv"], down: ["shorty"] } },
]

export function seasonFor(date: Date): Season {
  const m = date.getMonth() + 1
  return SEASONS.find((s) => s.months.includes(m))!.season
}

/** Веса сигналов. Продажи — главный: лучше всего предсказывают покупку; дальше остаток и спрос раздела. */
const W = { sales: 3, stock: 1.5, demand: 1.2, sizes: 1.5, fresh: 1.2, description: 0.25, discount: 0.3, season: 1, pinned: 100 }

/** Спрос раздела: продажи всех его товаров (и распроданных) за 60 дней, 0…1 от самого продаваемого раздела */
export function categoryDemand(items: CatalogItem[]): Map<string, number> {
  const sum = new Map<string, number>()
  for (const i of items) if (i.category) sum.set(i.category.handle, (sum.get(i.category.handle) ?? 0) + (i.sales ?? 0))
  const max = Math.max(0, ...sum.values())
  return new Map([...sum].map(([k, v]) => [k, max ? Math.log1p(v) / Math.log1p(max) : 0]))
}

export function rankItems<T extends CatalogItem>(items: T[], now: Date): (T & { rank: number })[] {
  const season = seasonFor(now)
  const maxSales = Math.max(0, ...items.map((i) => i.sales ?? 0))
  const demandOf = categoryDemand(items)
  return items.map((i) => {
    const sales = maxSales ? Math.log1p(i.sales ?? 0) / Math.log1p(maxSales) : 0
    const sizes = i.sizes.length ? i.sizes.filter((s) => s.in_stock).length / i.sizes.length : 0
    const discount = i.compare_at ? Math.min(1 - i.price / i.compare_at, 0.5) / 0.5 : 0
    const cat = i.category?.handle ?? ""
    const demand = demandOf.get(cat) ?? 0
    // Не по сезону опускаем только то, что не продаётся: футболки и бельё, которые берут круглый год, остаются
    const inSeason = season.up.includes(cat) ? 1 : season.down.includes(cat) ? -(1 - demand) : 0
    // Новое поступление большой партией — двойной вес остатка
    const stock = (i.stock_level ?? 0) * (i.is_new ? 2 : 1)
    const rank = W.sales * sales + W.stock * stock + W.demand * demand + W.sizes * sizes + W.fresh * (i.is_new ? 1 : 0)
      + W.description * (i.has_description ? 1 : 0) + W.discount * discount + W.season * inSeason + (i.pinned ? W.pinned : 0)
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
 * а в первых рядах чередуются бренды и разделы. Берём лучший подходящий товар из ближайших 30 (в первых рядах — из 120);
 * не нашёлся — сначала разрешаем повтор раздела (на странице раздела он и так один), потом берём лучший.
 */
export function diversify<T extends CatalogItem>(sorted: T[]): T[] {
  const rest = [...sorted]
  const out: T[] = []
  const LOOKAHEAD = 30
  const TOP = 48
  while (rest.length) {
    const recentModels = new Set(out.slice(-6).map(modelKey))
    const prev = out[out.length - 1]
    const top = out.length < TOP
    const okModel = (c: T) => !recentModels.has(modelKey(c))
    const okBrand = (c: T) => !top || !prev?.brand || c.brand?.handle !== prev.brand.handle
    const okCat = (c: T) => !top || !prev?.category || c.category?.handle !== prev.category.handle
    // В первых рядах ищем шире: другой раздел может быть заметно ниже по баллу
    const look = rest.slice(0, top ? 120 : LOOKAHEAD)
    let pick = look.findIndex((c) => c.pinned)
    if (pick < 0) pick = look.findIndex((c) => okModel(c) && okBrand(c) && okCat(c))
    if (pick < 0) pick = look.findIndex((c) => okModel(c) && okBrand(c))
    out.push(rest.splice(Math.max(pick, 0), 1)[0])
  }
  return out
}
