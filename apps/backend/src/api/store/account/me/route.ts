import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/** Данные покупателя и обновление имени / телефона. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const c = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id)
  res.json({ customer: { id: c.id, email: c.email, first_name: c.first_name, last_name: c.last_name, phone: c.phone } })
}

export async function POST(req: AuthenticatedMedusaRequest<{ first_name?: string; last_name?: string; phone?: string }>, res: MedusaResponse) {
  const b = req.body ?? {}
  const clean = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : undefined)
  const c = await req.scope.resolve(Modules.CUSTOMER).updateCustomers(req.auth_context.actor_id, {
    first_name: clean(b.first_name, 100),
    last_name: clean(b.last_name, 100),
    phone: clean(b.phone, 20),
  })
  res.json({ customer: { id: c.id, email: c.email, first_name: c.first_name, last_name: c.last_name, phone: c.phone } })
}
