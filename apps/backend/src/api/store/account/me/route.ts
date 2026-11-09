import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/** Данные покупателя, обновление имени / телефона / избранного. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const c = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id)
  res.json({ customer: view(c) })
}

type Body = { first_name?: string; last_name?: string; phone?: string; favorites?: unknown; birth_date?: string | null }

/** Избранное: адреса товаров (handle), до 300 штук. */
const favoritesOf = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,200}$/.test(x)))].slice(0, 300) : undefined

function view(c: { id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null; metadata?: Record<string, unknown> | null }) {
  return {
    id: c.id, email: c.email, first_name: c.first_name, last_name: c.last_name, phone: c.phone,
    birth_date: typeof c.metadata?.birth_date === "string" ? c.metadata.birth_date : null,
    favorites: favoritesOf(c.metadata?.favorites) ?? [],
  }
}

export async function POST(req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) {
  const b = req.body ?? {}
  const clean = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : undefined)
  const customers = req.scope.resolve(Modules.CUSTOMER)
  const favorites = favoritesOf(b.favorites)
  // Дата рождения: ГГГГ-ММ-ДД, не из будущего (для поздравлений и акций ко дню рождения)
  let birth: string | null | undefined
  if (b.birth_date !== undefined) {
    const d = String(b.birth_date ?? "").trim()
    if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)) || new Date(d) > new Date() || new Date(d).getFullYear() < 1900)) {
      res.status(400).json({ message: "Проверьте дату рождения" })
      return
    }
    birth = d || null
  }
  const needMeta = favorites || birth !== undefined
  const current = needMeta ? await customers.retrieveCustomer(req.auth_context.actor_id) : null
  const c = await customers.updateCustomers(req.auth_context.actor_id, {
    first_name: clean(b.first_name, 100),
    last_name: clean(b.last_name, 100),
    phone: clean(b.phone, 20),
    ...(needMeta ? { metadata: { ...(current?.metadata ?? {}), ...(favorites ? { favorites } : {}), ...(birth !== undefined ? { birth_date: birth } : {}) } } : {}),
  })
  res.json({ customer: view(c) })
}
