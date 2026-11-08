import "server-only"
import { cacheLife, cacheTag } from "next/cache"

import type { CatalogItem, CatalogProduct, Taxonomy } from "./types"

/** Сколько дней товар считается новинкой. */
const NEW_DAYS = 45

const BACKEND = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

async function store<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { "x-publishable-api-key": KEY, accept: "application/json" },
  })
  if (res.status === 404) {
    throw new NotFoundError(path)
  }
  if (!res.ok) {
    // Ошибка не кэшируется: исключение выходит из "use cache" (ТЗ, п. 7.1)
    throw new Error(`Medusa ${res.status} ${path}`)
  }
  return res.json() as Promise<T>
}

export class NotFoundError extends Error {}

/**
 * Весь каталог в лёгком виде. Кэш сбрасывается тегом "catalog" по событию из Medusa,
 * плюс страховочное обновление раз в 5 минут.
 */
export async function getCatalog(): Promise<CatalogItem[]> {
  "use cache"
  cacheTag("catalog")
  cacheLife({ stale: 60, revalidate: 300, expire: 86400 })
  const { items } = await store<{ items: CatalogItem[] }>("/store/catalog/products")
  // Признак новинки считается здесь, внутри кэша: текущее время нельзя брать при статической сборке
  const now = Date.now()
  return items.map((i) => ({ ...i, is_new: now - new Date(i.created_at).getTime() < NEW_DAYS * 86400 * 1000 }))
}

export async function getTaxonomy(): Promise<Taxonomy> {
  "use cache"
  cacheTag("catalog")
  cacheLife({ stale: 60, revalidate: 300, expire: 86400 })
  return store<Taxonomy>("/store/catalog/taxonomy")
}

/** Карточка товара; null — товара нет (404). */
export async function getProduct(handle: string): Promise<CatalogProduct | null> {
  "use cache"
  cacheTag("catalog", `product:${handle}`)
  cacheLife({ stale: 60, revalidate: 300, expire: 86400 })
  try {
    const { product } = await store<{ product: CatalogProduct }>(`/store/catalog/products/${encodeURIComponent(handle)}`)
    return product
  } catch (e) {
    if (e instanceof NotFoundError) return null
    throw e
  }
}
