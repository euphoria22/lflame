"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

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
  refresh: () => Promise<void>
  clear: () => void
}

const Ctx = createContext<CartState | null>(null)

/** Корзина на клиенте: данные через /api/cart (номер корзины — в httpOnly-cookie). */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const call = useCallback(async (url: string, init?: RequestInit) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } })
      const data = (await res.json()) as { cart?: Cart | null; error?: string }
      if (!res.ok) {
        setError(data.error ?? "Ошибка")
        return false
      }
      setCart(data.cart ?? null)
      return true
    } catch {
      setError("Нет связи. Попробуйте ещё раз.")
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const refresh = useCallback(async () => { await call("/api/cart") }, [call])

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

  const clear = useCallback(() => setCart(null), [])

  return <Ctx.Provider value={{ cart, open, busy, error, setOpen, add, update, remove, refresh, clear }}>{children}</Ctx.Provider>
}

export function useCart(): CartState {
  const v = useContext(Ctx)
  if (!v) throw new Error("useCart вне CartProvider")
  return v
}
