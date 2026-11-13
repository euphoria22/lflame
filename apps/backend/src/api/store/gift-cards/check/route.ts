import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { checkCard } from "../../../../lib/gift-cards/engine"

/** Баланс карты по коду (без личных данных). Частоту запросов ограничивает витрина. */
export async function POST(req: MedusaRequest<{ code?: string }>, res: MedusaResponse) {
  res.json(await checkCard(req.scope, String(req.body?.code ?? "")))
}
