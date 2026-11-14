import type { CatalogItem } from "../types"
import { arrange, ArrangeConfig, pinsFor, StorePin } from "./arrange"

/**
 * Порядок листинга по умолчанию (ТЗ сортировки): балл карточки считает сервер, здесь — разведение соседей
 * по карточкам, оставшимся после фильтров покупателя, закрепления и квота.
 */
export type SortData = { version: string; arrange: ArrangeConfig; pins: StorePin[] }

export type ListingKeyScope = { gender?: string; category?: string; brand?: string; color?: string; onlyNew?: boolean; onlyOutlet?: boolean; q?: string }

/** Ключ листинга: all, new, outlet, gender:men, cat:kurtki, brand:calvin-klein и сочетания через «/». По нему привязаны закрепления и события */
export function listingKey(scope: ListingKeyScope): string {
  const parts = [
    scope.gender && `gender:${scope.gender}`, scope.category && `cat:${scope.category}`, scope.brand && `brand:${scope.brand}`,
    scope.color && `color:${scope.color}`, scope.onlyNew && "new", scope.onlyOutlet && "outlet", scope.q && "search",
  ].filter(Boolean)
  return parts.length ? parts.join("/") : "all"
}

const byDate = (a: CatalogItem, b: CatalogItem) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)

// Порядок запоминается по версии: «Показать ещё» догружает страницы в том порядке, в котором покупатель начал, —
// без дублей и пропусков, даже если баллы за это время пересчитались
const orders = new Map<string, string[]>()
const MAX_ORDERS = 400

/**
 * Карточки в порядке умной сортировки. Баллов нет совсем (сервер ещё не считал) — по дате поступления.
 * version — версия порядка из запроса следующей страницы; filterSig — подпись фильтров покупателя.
 */
export function smartOrder<T extends CatalogItem>(items: T[], key: string, sort: SortData | null, opts: { filterSig?: string; version?: string } = {}): { items: T[]; version: string } {
  if (!sort || !items.some((i) => typeof i.score === "number")) return { items: [...items].sort(byDate), version: "date" }
  const by = new Map(items.map((i) => [i.id, i]))
  const cacheKey = (v: string) => `${v}|${key}|${opts.filterSig ?? ""}`
  const saved = opts.version && opts.version !== sort.version ? orders.get(cacheKey(opts.version)) : undefined
  if (saved) {
    // Старый порядок: карточки, которых уже нет, пропускаем; новые — в конец
    const seen = new Set(saved)
    return { items: [...saved.filter((id) => by.has(id)).map((id) => by.get(id)!), ...items.filter((i) => !seen.has(i.id)).sort(byDate)], version: opts.version! }
  }
  let ids = orders.get(cacheKey(sort.version))
  if (!ids || ids.length !== items.length || !ids.every((id) => by.has(id))) {
    ids = arrange(
      items.map((i) => ({
        id: i.id, score: i.score ?? 0, brand: i.brand?.handle ?? null, color: i.color, category: i.category?.handle ?? null,
        price: i.price, model: i.model ?? i.id, low_stats: i.low_stats,
      })),
      sort.arrange,
      pinsFor(sort.pins, key, items.map((i) => ({ id: i.id, brand: i.brand?.handle ?? null })))
    ).map((p) => p.id)
    if (orders.size >= MAX_ORDERS) orders.delete(orders.keys().next().value!)
    orders.set(cacheKey(sort.version), ids)
  }
  return { items: ids.map((id) => by.get(id)!), version: sort.version }
}
