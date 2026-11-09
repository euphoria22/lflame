import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { statusFor } from "../../../../../lib/loyalty/engine"

/** Уровень, сумма, прогресс и история покупателя (ТЗ, п. 6.7 «Личный кабинет»). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const c = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id)
  res.json({ loyalty: await statusFor(req.scope, { email: c.email, phone: c.phone }) })
}
