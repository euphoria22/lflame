import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cdekQuote } from "../../../../lib/delivery/cdek-client"
import { estimateParcel, ParcelItem } from "../../../../lib/delivery/parcel"
import { pochtaQuote } from "../../../../lib/delivery/pochta-client"
import { getShopSettings } from "../../../../lib/settings/shop-settings"
import { applyFreeShipping, applyMarkup, itemsTotal } from "../../../../lib/delivery/free-shipping"

type Body = { cart_id?: string; kind?: "cdek-pvz" | "cdek-door" | "pochta"; city_code?: number; postal_code?: string }

/**
 * Цена и срок доставки для показа на витрине. Окончательная цена при добавлении способа
 * в корзину считается провайдером доставки по тем же правилам.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const { cart_id, kind, city_code, postal_code } = req.body ?? {}
  if (!cart_id || !kind) {
    res.status(400).json({ message: "Не хватает данных" })
    return
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.title", "items.product_title", "items.quantity", "items.unit_price", "items.variant.weight", "items.variant.length", "items.variant.width", "items.variant.height", "items.variant.product.weight", "items.variant.product.length", "items.variant.product.width", "items.variant.product.height"],
    filters: { id: cart_id },
  })
  const cart = data[0] as unknown as { items?: (ParcelItem & { unit_price?: number })[] } | undefined
  if (!cart?.items?.length) {
    res.status(400).json({ message: "Корзина пуста" })
    return
  }
  const settings = await getShopSettings()
  const parcel = estimateParcel(cart.items, settings.parcel)
  try {
    const quote = kind === "pochta"
      ? await pochtaQuote(String(postal_code ?? ""), parcel.weight)
      : await cdekQuote(kind === "cdek-pvz" ? settings.cdek_tariff_pvz : settings.cdek_tariff_door, Number(city_code), parcel)
    const total = itemsTotal(cart.items)
    const from = settings.free_shipping_from
    // Цена для покупателя: перевозчик + наценка из админки
    quote.amount = applyMarkup(quote.amount, settings.markup[kind === "pochta" ? "pochta" : "cdek"])
    const amount = applyFreeShipping(quote.amount, total, from)
    res.json({ quote: { ...quote, amount, full_amount: quote.amount, free: amount === 0 && quote.amount > 0 }, free_from: from })
  } catch (e) {
    res.status(422).json({ message: (e as Error).message.replace(/^(СДЭК|Почта)( \d+)?: /, "") || "Доставка недоступна" })
  }
}
