import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { applyToCart } from "../../../../../../lib/gift-cards/cart"

/** Перед оплатой: поставить карту в корзину на актуальную сумму (вызывается витриной при оформлении) */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    res.json({ applied: await applyToCart(req.scope, req.params.id) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
