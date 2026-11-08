import { sizeKeyRank, sizeKeys, sizeLabel } from "./size-groups"
import type { CatalogItem } from "./types"
import type { GenderSlug } from "./routes"

/**
 * Фильтрация, сортировка и фасеты каталога (ТЗ, п. 6.2, 7.3).
 * Работает на сервере витрины по закэшированному каталогу.
 */
export type ListingScope = {
  gender?: GenderSlug
  category?: string
  brand?: string
  onlyNew?: boolean
  onlySale?: boolean
  q?: string
}

export type SortKey = "popular" | "new" | "price_asc" | "price_desc" | "discount"

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Популярные" },
  { key: "new", label: "Новинки" },
  { key: "price_asc", label: "Дешевле" },
  { key: "price_desc", label: "Дороже" },
  { key: "discount", label: "Скидка" },
]

export type ListingFilters = {
  /** Категории — там, где область не задаёт категорию (новинки, бренд, распродажа, раздел) */
  categories: string[]
  brands: string[]
  sizes: string[]
  colors: string[]
  priceMin: number | null
  priceMax: number | null
  sort: SortKey
  page: number
}

export const PAGE_SIZE = 80

type SearchParams = Record<string, string | string[] | undefined>

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v.join(",") : v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

const num = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

export function parseFilters(sp: SearchParams): ListingFilters {
  const sort = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) as SortKey
  return {
    categories: list(sp.cat),
    brands: list(sp.brand),
    sizes: list(sp.size),
    colors: list(sp.color),
    priceMin: num(sp.price_min),
    priceMax: num(sp.price_max),
    sort: SORTS.some((s) => s.key === sort) ? sort : "popular",
    page: num(sp.page) ?? 1,
  }
}

/** Есть ли в адресе параметры, кроме страницы: такие страницы не индексируются (п. 7.3). */
export function hasFilterParams(f: ListingFilters): boolean {
  return Boolean(f.categories.length || f.brands.length || f.sizes.length || f.colors.length || f.priceMin || f.priceMax || f.sort !== "popular")
}

/**
 * Параметры в адресе — всегда в одном (алфавитном) порядке, чтобы не плодить дубли (п. 7.3).
 * page=1 не пишется.
 */
export function filtersToQuery(f: Partial<ListingFilters>): string {
  const params: [string, string][] = []
  if (f.brands?.length) params.push(["brand", [...f.brands].sort().join(",")])
  if (f.categories?.length) params.push(["cat", [...f.categories].sort().join(",")])
  if (f.colors?.length) params.push(["color", [...f.colors].sort().join(",")])
  if (f.page && f.page > 1) params.push(["page", String(f.page)])
  if (f.priceMax) params.push(["price_max", String(f.priceMax)])
  if (f.priceMin) params.push(["price_min", String(f.priceMin)])
  if (f.sizes?.length) params.push(["size", [...f.sizes].sort((a, b) => sizeKeyRank(a) - sizeKeyRank(b)).join(",")])
  if (f.sort && f.sort !== "popular") params.push(["sort", f.sort])
  params.sort(([a], [b]) => a.localeCompare(b))
  const qs = new URLSearchParams(params).toString()
  return qs ? `?${qs}` : ""
}

/** Склеивает путь и параметры фильтра: у страницы поиска в пути уже есть ?q=. */
export function withQuery(basePath: string, query: string): string {
  if (!query) return basePath
  return basePath.includes("?") ? `${basePath}&${query.slice(1)}` : `${basePath}${query}`
}

export function isNew(item: CatalogItem): boolean {
  return Boolean(item.is_new)
}

function normalizeText(s: string) {
  return s.toLowerCase().replace(/ё/g, "е")
}

/** Товары области (раздел, категория, бренд, новинки, распродажа, поиск). */
export function scopeItems(items: CatalogItem[], scope: ListingScope): CatalogItem[] {
  const terms = scope.q ? normalizeText(scope.q).split(/\s+/).filter(Boolean) : []
  let res = items.filter((i) => {
    if (!i.in_stock) return false
    if (scope.gender && i.gender !== scope.gender && i.gender !== "unisex") return false
    if (scope.category && i.category?.handle !== scope.category) return false
    if (scope.brand && i.brand?.handle !== scope.brand) return false
    if (scope.onlySale && !i.compare_at) return false
    if (terms.length) {
      const hay = normalizeText(`${i.title} ${i.brand?.name ?? ""} ${i.category?.name ?? ""} ${i.color_name ?? ""}`)
      if (!terms.every((t) => hay.includes(t))) return false
    }
    return true
  })
  if (scope.onlyNew) {
    const fresh = res.filter((i) => isNew(i))
    // Если новинок мало (например, давно не было поступлений) — показываем последние поступившие
    res = fresh.length >= 24 ? fresh : [...res].sort(byNew).slice(0, 96)
  }
  return res
}

const byNew = (a: CatalogItem, b: CatalogItem) => b.created_at.localeCompare(a.created_at)

function sortItems(items: CatalogItem[], sort: SortKey): CatalogItem[] {
  const arr = [...items]
  switch (sort) {
    case "new":
      return arr.sort(byNew)
    case "price_asc":
      return arr.sort((a, b) => a.price - b.price)
    case "price_desc":
      return arr.sort((a, b) => b.price - a.price)
    case "discount": {
      const d = (i: CatalogItem) => (i.compare_at ? 1 - i.price / i.compare_at : 0)
      return arr.sort((a, b) => d(b) - d(a))
    }
    default: {
      // Пока нет статистики продаж: больше размеров в наличии и новее — выше
      const sizes = (i: CatalogItem) => i.sizes.filter((s) => s.in_stock).length
      return arr.sort((a, b) => sizes(b) - sizes(a) || byNew(a, b))
    }
  }
}

type Facet = { value: string; label: string; count: number }

export type ListingResult = {
  items: CatalogItem[]
  total: number
  page: number
  pages: number
  facets: {
    categories: Facet[]
    brands: Facet[]
    sizes: Facet[]
    colors: Facet[]
    price: { min: number; max: number }
  }
  /** Названия брендов и категорий области — для подписей выбранных фильтров */
  names: Record<string, string>
}

function matches(i: CatalogItem, f: ListingFilters, skip?: "category" | "brand" | "size" | "color" | "price"): boolean {
  if (skip !== "category" && f.categories.length && !f.categories.includes(i.category?.handle ?? "")) return false
  if (skip !== "brand" && f.brands.length && !f.brands.includes(i.brand?.handle ?? "")) return false
  if (skip !== "color" && f.colors.length && !f.colors.includes(i.color ?? "")) return false
  if (skip !== "size" && f.sizes.length && !i.sizes.some((s) => s.in_stock && sizeKeys(s.size).some((k) => f.sizes.includes(k)))) return false
  if (skip !== "price") {
    if (f.priceMin && i.price < f.priceMin) return false
    if (f.priceMax && i.price > f.priceMax) return false
  }
  return true
}

function count<T>(items: CatalogItem[], key: (i: CatalogItem) => T[], label: (v: T) => [string, string]): Facet[] {
  const map = new Map<string, Facet>()
  for (const i of items) {
    for (const v of new Set(key(i))) {
      const [value, l] = label(v)
      const f = map.get(value) ?? { value, label: l, count: 0 }
      f.count++
      map.set(value, f)
    }
  }
  return [...map.values()]
}

export function runListing(scoped: CatalogItem[], f: ListingFilters): ListingResult {
  const filtered = sortItems(scoped.filter((i) => matches(i, f)), f.sort)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, f.page), pages)

  const categories = count(
    scoped.filter((i) => matches(i, f, "category")),
    (i) => (i.category ? [i.category] : []),
    (c) => [c.handle, c.name]
  ).sort((a, b) => b.count - a.count)

  const brands = count(
    scoped.filter((i) => matches(i, f, "brand")),
    (i) => (i.brand ? [i.brand] : []),
    (b) => [b.handle, b.name]
  ).sort((a, b) => a.label.localeCompare(b.label))

  // Размеры сгруппированы: «46 (S)» входит в «S», «30x32» — в «W30» (lib/size-groups.ts)
  const sizeFacets = count(
    scoped.filter((i) => matches(i, f, "size")),
    (i) => i.sizes.filter((s) => s.in_stock).flatMap((s) => sizeKeys(s.size)),
    (k) => [k, sizeLabel(k)]
  ).sort((a, b) => sizeKeyRank(a.value) - sizeKeyRank(b.value))

  const colors = count(
    scoped.filter((i) => matches(i, f, "color")),
    (i) => (i.color ? [[i.color, i.color_name ?? i.color] as const] : []),
    ([c, n]) => [c, n]
  ).sort((a, b) => b.count - a.count)

  const prices = scoped.map((i) => i.price)
  const names: Record<string, string> = {}
  for (const i of scoped) {
    if (i.brand) names[`b:${i.brand.handle}`] = i.brand.name
    if (i.category) names[`c:${i.category.handle}`] = i.category.name
  }
  return {
    names,
    items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: filtered.length,
    page,
    pages,
    facets: {
      categories,
      brands,
      sizes: sizeFacets,
      colors,
      price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
    },
  }
}

/** Область листинга в параметры адреса — для подгрузки «Показать ещё» через /api/listing. */
export function scopeToQuery(scope: ListingScope): string {
  const p = new URLSearchParams()
  if (scope.gender) p.set("s_gender", scope.gender)
  if (scope.category) p.set("s_category", scope.category)
  if (scope.brand) p.set("s_brand", scope.brand)
  if (scope.onlyNew) p.set("s_new", "1")
  if (scope.onlySale) p.set("s_sale", "1")
  if (scope.q) p.set("s_q", scope.q)
  return p.toString()
}

export function scopeFromQuery(p: URLSearchParams): ListingScope {
  const g = p.get("s_gender")
  return {
    gender: g === "men" || g === "women" ? g : undefined,
    category: p.get("s_category") ?? undefined,
    brand: p.get("s_brand") ?? undefined,
    onlyNew: p.get("s_new") === "1",
    onlySale: p.get("s_sale") === "1",
    q: p.get("s_q") ?? undefined,
  }
}

/** Порог для индексируемой посадочной страницы (ТЗ, п. 7.3). */
export const LANDING_MIN_ITEMS = 3
