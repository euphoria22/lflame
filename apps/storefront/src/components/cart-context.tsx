"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

import { trackCartChange } from "@/lib/analytics"

import type { Cart } from "@/lib/cart-types"

type CartState = {
  cart: Cart | null
  open: boolean
  busy: boolean
  error: string | null
  setOpen: (v: boolean) => void
  add: (variantId: string, quantity?: number) => Promise<boolean>
  update: (lineId: string, quantity: number) => Promise<void>
  remove: (lineId: string) => Promise<void>
  changeSize: (lineId: string, variantId: string) => Promise<void>
  refresh: () => Promise<void>
  clear: () => void
  /** Применить (строка) или убрать (null) промокод; возвращает текст ошибки или null */
  promo: (code: string | null) => Promise<string | null>
}

const Ctx = createContext<CartState | null>(null)

/** Корзина на клиенте: данные через /api/cart (номер корзины — в httpOnly-cookie). */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = useRef<Cart | null>(null)

  const call = useCallback(async (url: string, init?: RequestInit, track = true) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } })
      const data = (await res.json()) as { cart?: Cart | null; error?: string }
      if (!res.ok) {
        setError(data.error ?? "Ошибка")
        return false
      }
      // Метрика: что добавили / убрали (при загрузке корзины — не считаем)
      if (track) trackCartChange(last.current, data.cart ?? null)
      last.current = data.cart ?? null
      setCart(data.cart ?? null)
      return true
    } catch {
      setError("Нет связи. Попробуйте ещё раз.")
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const refresh = useCallback(async () => { await call("/api/cart", undefined, false) }, [call])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- корзина загружается в браузере
    refresh()
  }, [refresh])

  const add = useCallback(async (variantId: string, quantity = 1) => {
    const ok = await call("/api/cart/items", { method: "POST", body: JSON.stringify({ variant_id: variantId, quantity }) })
    if (ok) setOpen(true)
    return ok
  }, [call])

  const update = useCallback(async (lineId: string, quantity: number) => {
    await call(`/api/cart/items/${lineId}`, { method: "PATCH", body: JSON.stringify({ quantity }) })
  }, [call])

  const remove = useCallback(async (lineId: string) => {
    await call(`/api/cart/items/${lineId}`, { method: "DELETE" })
  }, [call])

  const changeSize = useCallback(async (lineId: string, variantId: string) => {
    await call(`/api/cart/items/${lineId}`, { method: "PATCH", body: JSON.stringify({ variant_id: variantId }) })
  }, [call])

  const clear = useCallback(() => setCart(null), [])

  const promo = useCallback(async (code: string | null) => {
    setBusy(true)
    try {
      const res = await fetch("/api/cart/promo", { method: code ? "POST" : "DELETE", headers: { "content-type": "application/json" }, body: code ? JSON.stringify({ code }) : undefined })
      const data = (await res.json()) as { cart?: Cart | null; promoError?: string | null; error?: string }
      if (data.cart !== undefined) { last.current = data.cart ?? null; setCart(data.cart ?? null) }
      return data.promoError ?? data.error ?? null
    } catch {
      return "Нет связи. Попробуйте ещё раз."
    } finally {
      setBusy(false)
    }
  }, [])

  return <Ctx.Provider value={{ cart, open, busy, error, setOpen, add, update, remove, changeSize, refresh, clear, promo }}>{children}</Ctx.Provider>
}

export function useCart(): CartState {
  const v = useContext(Ctx)
  if (!v) throw new Error("useCart вне CartProvider")
  return v
}
