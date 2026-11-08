import { getShopSettings } from "../settings/shop-settings"

/**
 * Бесплатная доставка от суммы товаров. Порог меняется в админке («Доставка и оплата»),
 * по умолчанию — FREE_SHIPPING_FROM из .env (12 000 ₽). 0 — выключено.
 */
export async function freeShippingFrom(): Promise<number> {
  return (await getShopSettings()).free_shipping_from
}

export type PricedItem = { unit_price?: unknown; quantity?: unknown }

export function itemsTotal(items: PricedItem[]): number {
  return items.reduce((s, i) => s + Number(i.unit_price ?? 0) * Number(i.quantity ?? 1), 0)
}

/** Цена доставки с учётом порога. */
export function applyFreeShipping(amount: number, total: number, from: number): number {
  return from && total >= from ? 0 : amount
}
