import "server-only"
import { cookies } from "next/headers"

import type { Cart } from "./cart-types"

/**
 * Запросы к Medusa Store API от имени покупателя (корзина, оформление).
 * Номер корзины хранится в httpOnly-cookie: браузеру он не виден (ТЗ, п. 6.4, 8.3).
 */
const BACKEND = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
export const CART_COOKIE = "lf_cart"

export class StoreApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function storeFetch<T>(path: string, init: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "x-publishable-api-key": KEY, "content-type": "application/json", accept: "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new StoreApiError((data as { message?: string }).message ?? `Medusa ${res.status}`, res.status)
  }
  return data as T
}

const CART_FIELDS = "id,total,item_total,item_subtotal,discount_total,shipping_total,metadata,promotions.code,*items,items.variant_id,items.product_handle,items.variant_title"

type MedusaCart = {
  id: string
  total: number
  item_total: number
  item_subtotal?: number
  discount_total?: number
  shipping_total: number
  metadata?: { promo_code?: string | null } | null
  promotions?: { code: string | null }[]
  completed_at?: string | null
  items?: {
    id: string
    variant_id: string
    product_title: string
    title: string
    variant_title: string | null
    product_handle: string | null
    thumbnail: string | null
    quantity: number
    unit_price: number
    total: number
    metadata?: { loyalty?: { level: string; pct: number; base: number } | null } | null
  }[]
}

export function toCart(c: MedusaCart): Cart {
  const lines = (c.items ?? [])
    .map((i) => ({
      id: i.id,
      variant_id: i.variant_id,
      title: i.product_title ?? i.title,
      size: i.variant_title ?? "",
      handle: i.product_handle,
      thumbnail: i.thumbnail,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      total: Number(i.total),
      base_price: i.metadata?.loyalty?.base ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
  return {
    id: c.id,
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    item_total: Number(c.item_total),
    goods_total: Number(c.item_total),
    shipping_total: Number(c.shipping_total),
    total: Number(c.total),
    loyalty: loyaltyOf(c),
    promo: promoOf(c),
  }
}

function promoOf(c: MedusaCart): Cart["promo"] {
  const code = c.metadata?.promo_code
  if (!code) return null
  const applied = (c.promotions ?? []).some((p) => p.code?.toUpperCase() === code.toUpperCase())
  return applied
    ? { code, applied, saved: Math.round(Number(c.discount_total ?? 0)), note: null }
    : { code, applied, saved: 0, note: "Скидка LAFLAMME Club выгоднее — применили её. Промокод и скидка не суммируются." }
}

function loyaltyOf(c: MedusaCart): Cart["loyalty"] {
  const items = (c.items ?? []).filter((i) => i.metadata?.loyalty)
  if (!items.length) return null
  const l = items[0].metadata!.loyalty!
  const saved = items.reduce((s, i) => s + (i.metadata!.loyalty!.base - Number(i.unit_price)) * i.quantity, 0)
  return saved > 0 ? { level: l.level, pct: l.pct, saved: Math.round(saved) } : null
}

export async function getCartId(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null
}

export async function setCartId(id: string | null) {
  const jar = await cookies()
  if (!id) {
    jar.delete(CART_COOKIE)
    return
  }
  jar.set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

/** Текущая корзина или null (нет cookie, корзина удалена или уже оформлена). */
export async function retrieveCart(): Promise<MedusaCart | null> {
  const id = await getCartId()
  if (!id) return null
  try {
    const { cart } = await storeFetch<{ cart: MedusaCart }>(`/store/carts/${id}?fields=${CART_FIELDS}`)
    if (cart.completed_at) return null
    return cart
  } catch (e) {
    if (e instanceof StoreApiError && e.status === 404) return null
    throw e
  }
}

async function regionId(): Promise<string> {
  const { regions } = await storeFetch<{ regions: { id: string }[] }>("/store/regions")
  return regions[0].id
}

export async function ensureCart(): Promise<MedusaCart> {
  const existing = await retrieveCart()
  if (existing) return existing
  const { cart } = await storeFetch<{ cart: MedusaCart }>(`/store/carts?fields=${CART_FIELDS}`, {
    method: "POST",
    body: { region_id: await regionId() },
  })
  await setCartId(cart.id)
  return cart
}

export async function cartRequest(path: string, method: string, body?: unknown): Promise<MedusaCart> {
  const { cart } = await storeFetch<{ cart: MedusaCart }>(`${path}${path.includes("?") ? "&" : "?"}fields=${CART_FIELDS}`, { method, body })
  return cart
}

/** Понятные сообщения вместо технических ошибок Medusa. */
export function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/inventory|stock|insufficient/i.test(msg)) return "Этого размера больше нет в наличии"
  return "Не получилось обновить корзину. Попробуйте ещё раз."
}

/* ---------- Вход в личный кабинет ---------- */

export const AUTH_COOKIE = "lf_auth"

export async function getAuthToken(): Promise<string | null> {
  return (await cookies()).get(AUTH_COOKIE)?.value ?? null
}

export async function setAuthToken(token: string | null) {
  const jar = await cookies()
  if (!token) {
    jar.delete(AUTH_COOKIE)
    return
  }
  // Токен Medusa живёт 30 дней (jwtExpiresIn в medusa-config)
  jar.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 })
}

export type Customer = { id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null }

/** Вошедший покупатель или null (нет входа или токен истёк). */
export async function currentCustomer(): Promise<Customer | null> {
  const token = await getAuthToken()
  if (!token) return null
  try {
    return (await storeFetch<{ customer: Customer }>("/store/account/me", { token })).customer
  } catch {
    return null
  }
}

/**
 * Скидка уровня в корзине: привязка корзины к вошедшему покупателю и пересчёт цен на сервере.
 * Без входа — обычные цены. Ошибки не мешают покупке.
 */
export async function syncLoyalty(cartId: string): Promise<void> {
  const token = await getAuthToken()
  if (token) await storeFetch(`/store/carts/${cartId}/customer`, { method: "POST", token }).catch(() => null)
  await storeFetch("/store/loyalty/cart", { method: "POST", body: { cart_id: cartId }, token }).catch(() => null)
}

/** Применить (code — строка) или убрать (null) промокод. Возвращает текст ошибки, если код не подошёл. */
export async function applyPromo(cartId: string, code: string | null): Promise<string | null> {
  const token = await getAuthToken()
  if (token) await storeFetch(`/store/carts/${cartId}/customer`, { method: "POST", token }).catch(() => null)
  const r = await storeFetch<{ error?: string }>("/store/loyalty/cart", { method: "POST", body: { cart_id: cartId, promo_code: code }, token })
  return r.error ?? null
}
