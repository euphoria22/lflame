import "server-only"
import { cacheLife, cacheTag } from "next/cache"

import { rankItems } from "./ranking"
import type { CatalogItem, CatalogProduct, Taxonomy } from "./types"

/** Сколько дней товар считается новинкой. */
const NEW_DAYS = 45

const BACKEND = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

/** Короткий перезапуск Medusa (обновление, нехватка памяти) не должен валить сборку и страницы: 3 попытки. */
async function fetchRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, init)
      if ((res.status === 502 || res.status === 503) && i < attempts) throw new Error(`Medusa ${res.status}`)
      return res
    } catch (e) {
      if (i >= attempts) throw e
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
}

async function store<T>(path: string): Promise<T> {
  const res = await fetchRetry(`${BACKEND}${path}`, {
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
  // Новинка: отмечена вручную в админке или поступила после запуска сайта и не старше 45 дней.
  // Стартовый ассортимент (первая загрузка из МоегоСклада) новинкой сам по себе не считается.
  const withNew = items.map((i) => ({
    ...i,
    is_new: Boolean(i.new_manual) || (!i.initial_import && now - new Date(i.created_at).getTime() < NEW_DAYS * 86400 * 1000),
  }))
  return rankItems(withNew, new Date(now))
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

/** Способы оплаты для витрины (показ «Сплит» в карточке); меняются редко, кэш на 10 минут. */
export async function getPaymentOptions(): Promise<{ split_payment: boolean }> {
  "use cache"
  cacheTag("settings")
  cacheLife({ stale: 300, revalidate: 600, expire: 86400 })
  try {
    const o = await store<{ split_payment?: boolean }>("/store/checkout/options")
    return { split_payment: Boolean(o.split_payment) }
  } catch {
    return { split_payment: false }
  }
}
