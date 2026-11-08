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

/** Наценка на доставку: рубли к цене перевозчика или процент от неё. */
export type Markup = { type: "rub" | "pct"; value: number }

export const NO_MARKUP: Markup = { type: "rub", value: 0 }

/** Цена перевозчика + наценка, округление вверх до рубля. */
export function applyMarkup(amount: number, m: Markup = NO_MARKUP): number {
  const add = m.type === "pct" ? (amount * m.value) / 100 : m.value
  return Math.max(0, Math.ceil(amount + (Number.isFinite(add) ? add : 0)))
}
