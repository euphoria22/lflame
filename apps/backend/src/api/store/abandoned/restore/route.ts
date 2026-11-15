import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { restoreCart } from "../../../../lib/abandoned/abandoned"

/** Возврат по ссылке из письма о брошенной корзине: проверка подписи (витрина потом ставит эту корзину покупателю) */
export async function POST(req: MedusaRequest<{ cart_id?: string; token?: string }>, res: MedusaResponse) {
  const r = await restoreCart(req.scope, String(req.body?.cart_id ?? ""), String(req.body?.token ?? ""))
  res.status(r.ok ? 200 : 400).json(r)
}
