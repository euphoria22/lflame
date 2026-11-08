import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CDEK_TARIFFS, cdekQuote } from "../../../../lib/delivery/cdek-client"
import { estimateParcel, ParcelItem } from "../../../../lib/delivery/parcel"
import { pochtaQuote } from "../../../../lib/delivery/pochta-client"

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
    fields: ["id", "items.title", "items.product_title", "items.quantity", "items.variant.weight"],
    filters: { id: cart_id },
  })
  const cart = data[0] as unknown as { items?: ParcelItem[] } | undefined
  if (!cart?.items?.length) {
    res.status(400).json({ message: "Корзина пуста" })
    return
  }
  const parcel = estimateParcel(cart.items)
  try {
    const quote = kind === "pochta"
      ? await pochtaQuote(String(postal_code ?? ""), parcel.weight)
      : await cdekQuote(kind === "cdek-pvz" ? CDEK_TARIFFS.pvz : CDEK_TARIFFS.door, Number(city_code), parcel)
    res.json({ quote })
  } catch (e) {
    res.status(422).json({ message: (e as Error).message.replace(/^(СДЭК|Почта)( \d+)?: /, "") || "Доставка недоступна" })
  }
}
