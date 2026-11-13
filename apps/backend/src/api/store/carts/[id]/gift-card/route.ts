import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cartGiftCard, setCartGiftCard } from "../../../../../lib/gift-cards/cart"

/** Подарочная карта в корзине: какая и сколько спишется */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    res.json({ gift_card: await cartGiftCard(req.scope, req.params.id) })
  } catch (e) {
    res.status(404).json({ message: (e as Error).message })
  }
}

/** Применить карту по коду ({ code }) или убрать ({ code: null }) */
export async function POST(req: MedusaRequest<{ code?: string | null }>, res: MedusaResponse) {
  try {
    res.json({ gift_card: await setCartGiftCard(req.scope, req.params.id, req.body?.code ? String(req.body.code) : null) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
