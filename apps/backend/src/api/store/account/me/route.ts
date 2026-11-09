import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/** Данные покупателя, обновление имени / телефона / избранного. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const c = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id)
  res.json({ customer: view(c) })
}

type Body = { first_name?: string; last_name?: string; phone?: string; favorites?: unknown }

/** Избранное: адреса товаров (handle), до 300 штук. */
const favoritesOf = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,200}$/.test(x)))].slice(0, 300) : undefined

function view(c: { id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null; metadata?: Record<string, unknown> | null }) {
  return { id: c.id, email: c.email, first_name: c.first_name, last_name: c.last_name, phone: c.phone, favorites: favoritesOf(c.metadata?.favorites) ?? [] }
}

export async function POST(req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) {
  const b = req.body ?? {}
  const clean = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : undefined)
  const customers = req.scope.resolve(Modules.CUSTOMER)
  const favorites = favoritesOf(b.favorites)
  const current = favorites ? await customers.retrieveCustomer(req.auth_context.actor_id) : null
  const c = await customers.updateCustomers(req.auth_context.actor_id, {
    first_name: clean(b.first_name, 100),
    last_name: clean(b.last_name, 100),
    phone: clean(b.phone, 20),
    ...(favorites ? { metadata: { ...(current?.metadata ?? {}), favorites } } : {}),
  })
  res.json({ customer: view(c) })
}
