import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PurchaseInput, startPurchase } from "../../../../lib/gift-cards/engine"

/** Купить подарочную карту: ссылка на оплату в Т-Кассе. Карта начнёт действовать после оплаты. */
export async function POST(req: MedusaRequest<PurchaseInput>, res: MedusaResponse) {
  try {
    res.json(await startPurchase(req.scope, req.body ?? ({} as PurchaseInput)))
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
