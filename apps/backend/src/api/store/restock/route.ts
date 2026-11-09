import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { subscribeRestock } from "../../../lib/restock/restock"

/** «Сообщить о поступлении»: email + размер (вариант). */
export async function POST(req: MedusaRequest<{ email?: string; variant_id?: string }>, res: MedusaResponse) {
  try {
    const r = await subscribeRestock(req.scope, { email: String(req.body?.email ?? ""), variant_id: String(req.body?.variant_id ?? "") })
    res.json({ ok: true, already: r.already })
  } catch (e) {
    const status = e instanceof MedusaError && e.type === MedusaError.Types.NOT_FOUND ? 404 : 400
    res.status(status).json({ message: (e as Error).message })
  }
}
