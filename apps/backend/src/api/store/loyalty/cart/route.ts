import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { applyCartLoyalty } from "../../../../lib/loyalty/cart"

/** Пересчитать скидку уровня в корзине. Без входа — обычные цены. */
export async function POST(req: AuthenticatedMedusaRequest<{ cart_id?: string }>, res: MedusaResponse) {
  const cartId = req.body?.cart_id
  if (!cartId) {
    res.status(400).json({ message: "Нет корзины" })
    return
  }
  const loyalty = await applyCartLoyalty(req.scope, cartId, req.auth_context?.actor_id ?? null)
  res.json({ loyalty })
}
