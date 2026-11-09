/**
 * Яндекс Метрика: электронная коммерция через dataLayer (ТЗ, п. 7.13) и цели.
 * Данные копятся в dataLayer всегда, а сам счётчик загружается только после согласия на cookie (ТЗ, п. 8.7) —
 * при загрузке Метрика заберёт накопленное. Без номера счётчика (NEXT_PUBLIC_YM_ID) ничего не отправляется.
 */
import type { Cart, CartLine } from "./cart-types"

export const YM_ID = Number(process.env.NEXT_PUBLIC_YM_ID || 0)

type Product = { id: string; name: string; price: number; quantity?: number; variant?: string; brand?: string; category?: string }
type W = Window & { dataLayer?: unknown[]; ym?: (id: number, method: string, ...args: unknown[]) => void }

function push(action: string, products: Product[], extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !YM_ID || !products.length) return
  const w = window as W
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ ecommerce: { currencyCode: "RUB", [action]: { ...extra, products } } })
}

export function goal(name: string) {
  if (typeof window === "undefined" || !YM_ID) return
  ;(window as W).ym?.(YM_ID, "reachGoal", name)
}

const fromLine = (l: CartLine, quantity = l.quantity): Product => ({ id: l.handle ?? l.variant_id, name: l.title, price: l.unit_price, quantity, variant: l.size })

export const trackView = (p: Product) => push("detail", [p])

/** Сравнение корзины до и после изменения: что добавилось и что убрали. */
export function trackCartChange(before: Cart | null, after: Cart | null) {
  const prev = new Map((before?.lines ?? []).map((l) => [l.variant_id, l]))
  const next = new Map((after?.lines ?? []).map((l) => [l.variant_id, l]))
  const added: Product[] = []
  const removed: Product[] = []
  for (const [id, l] of next) {
    const q = l.quantity - (prev.get(id)?.quantity ?? 0)
    if (q > 0) added.push(fromLine(l, q))
    if (q < 0) removed.push(fromLine(l, -q))
  }
  for (const [id, l] of prev) if (!next.has(id)) removed.push(fromLine(l))
  push("add", added)
  push("remove", removed)
}

const PURCHASE_KEY = "lf_purchase"

/** Перед уходом на оплату / страницу «Заказ оформлен» — запоминаем состав заказа. */
export function rememberPurchase(cart: Cart | null) {
  if (!cart?.lines.length) return
  try { sessionStorage.setItem(PURCHASE_KEY, JSON.stringify(cart.lines.map((l) => fromLine(l)))) } catch { /* приватный режим */ }
}

/** «Заказ оформлен»: покупка (один раз). */
export function trackPurchase(orderNumber: string) {
  try {
    const raw = sessionStorage.getItem(PURCHASE_KEY)
    if (!raw) return
    sessionStorage.removeItem(PURCHASE_KEY)
    push("purchase", JSON.parse(raw) as Product[], { actionField: { id: orderNumber } })
    goal("purchase")
  } catch { /* нет хранилища — без покупки в отчёте */ }
}
