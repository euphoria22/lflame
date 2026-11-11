import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Статистика заказов сайта для раздела «Статистика» в админке.
 * Считается по заказам за период (отменённые — отдельно), сравнение — с предыдущим периодом той же длины.
 * Дни — по московскому времени.
 */

type Row = {
  id: string
  display_id: number | string
  created_at: string | Date
  status: string
  email?: string | null
  total?: unknown
  discount_total?: unknown
  shipping_total?: unknown
  metadata?: Record<string, unknown> | null
  shipping_address?: { city?: string | null; province?: string | null } | null
  shipping_methods?: { name?: string | null }[] | null
  payment_collections?: { status?: string | null }[] | null
  items?: {
    quantity?: unknown
    total?: unknown
    product_title?: string | null
    product?: { handle?: string | null; brand?: { name?: string | null } | null; categories?: { name?: string | null }[] | null } | null
  }[] | null
}

export type Bucket = { key: string; orders: number; revenue: number; qty?: number }
export type OrderStats = {
  from: string
  to: string
  summary: {
    orders: number; revenue: number; avg_check: number; items: number; canceled: number
    paid_orders: number; new_customers: number; returning_customers: number; discount: number
    prev_orders: number; prev_revenue: number
  }
  by_day: Bucket[]
  cities: Bucket[]
  regions: Bucket[]
  delivery: Bucket[]
  payment: Bucket[]
  products: Bucket[]
  brands: Bucket[]
  categories: Bucket[]
  promo: Bucket[]
}

const num = (v: unknown) => {
  const n = Number(typeof v === "object" && v !== null && "numeric" in (v as object) ? (v as { numeric: unknown }).numeric : v)
  return Number.isFinite(n) ? n : 0
}
const PAYMENT: Record<string, string> = { tbank: "Онлайн (Т-Банк)", manual: "Предоплата по ссылке", cod: "При получении" }
const mskDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" })

function top(map: Map<string, Bucket>, limit: number, by: "revenue" | "qty" = "revenue"): Bucket[] {
  return [...map.values()].sort((a, b) => (by === "qty" ? (b.qty ?? 0) - (a.qty ?? 0) : 0) || b.revenue - a.revenue || b.orders - a.orders).slice(0, limit)
}
function add(map: Map<string, Bucket>, key: string, revenue: number, qty = 0) {
  const b = map.get(key) ?? { key, orders: 0, revenue: 0, qty: 0 }
  b.orders += 1
  b.revenue += revenue
  b.qty = (b.qty ?? 0) + qty
  map.set(key, b)
}

async function loadOrders(container: MedusaContainer, from: Date, to: Date): Promise<Row[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "created_at", "status", "email", "total", "discount_total", "shipping_total", "metadata",
      "shipping_address.city", "shipping_address.province", "shipping_methods.name", "payment_collections.status",
      "items.quantity", "items.total", "items.product_title",
      "items.product.handle", "items.product.brand.name", "items.product.categories.name",
    ],
    filters: { created_at: { $gte: from, $lt: to } },
    pagination: { take: 20000 },
  })
  return data as unknown as Row[]
}

export async function orderStats(container: MedusaContainer, from: Date, to: Date): Promise<OrderStats> {
  const span = to.getTime() - from.getTime()
  const [orders, prev] = await Promise.all([
    loadOrders(container, from, to),
    loadOrders(container, new Date(from.getTime() - span), from),
  ])
  const live = orders.filter((o) => o.status !== "canceled")
  const prevLive = prev.filter((o) => o.status !== "canceled")

  // Новые и повторные покупатели: был ли у этого email заказ до начала периода
  const emails = [...new Set(live.map((o) => (o.email ?? "").toLowerCase()).filter(Boolean))]
  const earlier = new Set<string>()
  if (emails.length) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "order", fields: ["email", "status"], filters: { email: emails, created_at: { $lt: from } }, pagination: { take: 20000 } })
    for (const o of data as { email?: string | null; status: string }[]) if (o.status !== "canceled" && o.email) earlier.add(o.email.toLowerCase())
  }

  const byDay = new Map<string, Bucket>()
  for (let t = from.getTime(); t < to.getTime(); t += 86400000) {
    const k = mskDay(new Date(t))
    byDay.set(k, { key: k, orders: 0, revenue: 0 })
  }
  const cities = new Map<string, Bucket>(), regions = new Map<string, Bucket>(), delivery = new Map<string, Bucket>()
  const payment = new Map<string, Bucket>(), products = new Map<string, Bucket>(), brands = new Map<string, Bucket>()
  const categories = new Map<string, Bucket>(), promo = new Map<string, Bucket>()
  let revenue = 0, items = 0, paid = 0, discount = 0

  for (const o of live) {
    const total = num(o.total)
    revenue += total
    discount += num(o.discount_total)
    add(byDay, mskDay(new Date(o.created_at)), total)
    const method = o.shipping_methods?.[0]?.name ?? "—"
    const pickup = /самовывоз/i.test(method)
    add(cities, pickup ? "Омск (самовывоз)" : (o.shipping_address?.city || "Не указан").trim(), total)
    add(regions, pickup ? "Омская обл." : (o.shipping_address?.province || "Не указан").trim(), total)
    add(delivery, method, total)
    const pm = String(o.metadata?.payment_method ?? "")
    add(payment, PAYMENT[pm] ?? (pm || "—"), total)
    // Оплачен онлайн: выбрана оплата Т-Банком и платёж прошёл (у «при получении» Medusa тоже ставит «авторизован»)
    if (pm === "tbank" && o.payment_collections?.some((p) => p?.status === "completed" || p?.status === "authorized")) paid++
    const code = typeof o.metadata?.promo_code === "string" ? o.metadata.promo_code : null
    if (code) add(promo, code.toUpperCase(), num(o.discount_total))

    // Товары, бренды и категории: каждый считается в заказе один раз, выручка — по строкам
    const seen = { p: new Set<string>(), b: new Set<string>(), c: new Set<string>() }
    for (const it of o.items ?? []) {
      const q = num(it.quantity), sum = num(it.total)
      items += q
      const pk = it.product_title || it.product?.handle || "—"
      const bk = it.product?.brand?.name || "Без бренда"
      const ck = it.product?.categories?.[0]?.name || "Без категории"
      const bump = (map: Map<string, Bucket>, set: Set<string>, k: string) => {
        const b = map.get(k) ?? { key: k, orders: 0, revenue: 0, qty: 0 }
        if (!set.has(k)) { b.orders++; set.add(k) }
        b.revenue += sum
        b.qty = (b.qty ?? 0) + q
        map.set(k, b)
      }
      bump(products, seen.p, pk)
      bump(brands, seen.b, bk)
      bump(categories, seen.c, ck)
    }
  }

  const newCustomers = emails.filter((e) => !earlier.has(e)).length
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    summary: {
      orders: live.length,
      revenue: Math.round(revenue),
      avg_check: live.length ? Math.round(revenue / live.length) : 0,
      items,
      canceled: orders.length - live.length,
      paid_orders: paid,
      new_customers: newCustomers,
      returning_customers: emails.length - newCustomers,
      discount: Math.round(discount),
      prev_orders: prevLive.length,
      prev_revenue: Math.round(prevLive.reduce((s, o) => s + num(o.total), 0)),
    },
    by_day: [...byDay.values()],
    cities: top(cities, 20),
    regions: top(regions, 15),
    delivery: top(delivery, 10),
    payment: top(payment, 10),
    products: top(products, 20, "qty"),
    brands: top(brands, 20),
    categories: top(categories, 20),
    promo: top(promo, 20),
  }
}
