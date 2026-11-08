/**
 * Бесплатная доставка от суммы заказа (по умолчанию 12 000 ₽).
 * Порог — FREE_SHIPPING_FROM в .env (0 — выключено). Сумма — товары по ценам продажи.
 */
export function freeShippingFrom(): number {
  const v = Number(process.env.FREE_SHIPPING_FROM ?? 12000)
  return Number.isFinite(v) && v > 0 ? v : 0
}

export type PricedItem = { unit_price?: unknown; quantity?: unknown }

export function itemsTotal(items: PricedItem[]): number {
  return items.reduce((s, i) => s + Number(i.unit_price ?? 0) * Number(i.quantity ?? 1), 0)
}

/** Цена доставки с учётом порога. */
export function applyFreeShipping(amount: number, total: number): number {
  const from = freeShippingFrom()
  return from && total >= from ? 0 : amount
}
