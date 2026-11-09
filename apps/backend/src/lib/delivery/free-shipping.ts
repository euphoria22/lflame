import { container } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getShopSettings } from "../settings/shop-settings"

/**
 * Бесплатная доставка от суммы товаров. Порог меняется в админке («Доставка и оплата»),
 * по умолчанию — FREE_SHIPPING_FROM из .env (12 000 ₽). 0 — выключено.
 */
export async function freeShippingFrom(): Promise<number> {
  return (await getShopSettings()).free_shipping_from
}

export type PricedItem = { unit_price?: unknown; quantity?: unknown; adjustments?: { amount?: unknown }[] | null }

/** Сумма товаров для порога бесплатной доставки: после скидки LAFLAMME (она в цене) и после промокода (adjustments). */
export function itemsTotal(items: PricedItem[]): number {
  return items.reduce((s, i) => {
    const off = (i.adjustments ?? []).reduce((a, x) => a + Number(x.amount ?? 0), 0)
    return s + Number(i.unit_price ?? 0) * Number(i.quantity ?? 1) - off
  }, 0)
}

/** То же для расчёта цены доставки в провайдере: промокод берём из самой корзины (в контексте его может не быть). */
export async function cartGoodsTotal(context: { id?: string; items?: unknown[] }): Promise<number> {
  if (context.id) {
    try {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "cart",
        fields: ["id", "items.unit_price", "items.quantity", "items.adjustments.amount"],
        filters: { id: context.id },
      })
      const cart = data[0] as { items?: PricedItem[] } | undefined
      if (cart?.items) return itemsTotal(cart.items)
    } catch {
      // нет корзины — считаем по контексту
    }
  }
  return itemsTotal((context.items ?? []) as PricedItem[])
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
