import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { priceCart } from "../../../../lib/loyalty/cart-pricing"

/**
 * Пересчитать цены корзины: скидка уровня LAFLAMME или промокод (что выгоднее).
 * promo_code: строка — применить, null — убрать, не передан — оставить как было. Без входа — без скидки уровня.
 */
export async function POST(req: AuthenticatedMedusaRequest<{ cart_id?: string; promo_code?: string | null }>, res: MedusaResponse) {
  const cartId = req.body?.cart_id
  if (!cartId) {
    res.status(400).json({ message: "Нет корзины" })
    return
  }
  const result = await priceCart(req.scope, cartId, req.auth_context?.actor_id ?? null, req.body?.promo_code)
  res.json(result)
}
