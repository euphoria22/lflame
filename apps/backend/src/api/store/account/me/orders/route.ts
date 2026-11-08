import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

type OrderRow = {
  id: string
  display_id: number
  created_at: string
  status: string
  fulfillment_status: string
  payment_status: string
  total: unknown
  shipping_total: unknown
  metadata: Record<string, unknown> | null
  shipping_methods?: { name: string }[]
  shipping_address?: { address_1?: string; city?: string } | null
  items?: { id: string; product_title?: string; title: string; variant_title?: string | null; quantity: number; unit_price: unknown; thumbnail?: string | null; product_handle?: string | null }[]
  fulfillments?: { canceled_at: string | null; shipped_at: string | null; delivered_at: string | null; data: Record<string, unknown> | null; labels?: { tracking_number: string; tracking_url: string }[] }[]
}

/** Статус для покупателя — простыми словами. */
function humanStatus(o: OrderRow): { code: string; label: string } {
  if (o.status === "canceled") return { code: "canceled", label: "Отменён" }
  const f = (o.fulfillments ?? []).filter((x) => !x.canceled_at)
  if (f.some((x) => x.delivered_at) || o.fulfillment_status === "delivered") return { code: "delivered", label: "Получен" }
  if (f.some((x) => x.shipped_at) || o.fulfillment_status === "shipped") {
    const st = f.find((x) => x.data?.cdek_status_name)?.data?.cdek_status_name as string | undefined
    return { code: "shipped", label: st ? `В пути · ${st}` : "В пути" }
  }
  if (f.length) return { code: "packed", label: "Собран, готовим к отправке" }
  return { code: "new", label: "Принят" }
}

/**
 * Заказы покупателя: привязанные к аккаунту и оформленные как гость на тот же email
 * (email подтверждён кодом при входе).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id
  const customer = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(customerId)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "created_at", "status", "fulfillment_status", "payment_status", "total", "shipping_total", "metadata",
      "shipping_methods.name", "shipping_address.address_1", "shipping_address.city",
      "items.id", "items.product_title", "items.title", "items.variant_title", "items.quantity", "items.unit_price", "items.thumbnail", "items.product_handle",
      "fulfillments.canceled_at", "fulfillments.shipped_at", "fulfillments.delivered_at", "fulfillments.data", "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url",
    ],
    filters: { $or: [{ customer_id: customerId }, { email: customer.email }] },
    pagination: { order: { created_at: "DESC" }, take: 100 },
  })
  res.json({
    customer: { email: customer.email, first_name: customer.first_name, last_name: customer.last_name, phone: customer.phone },
    orders: (data as unknown as OrderRow[]).map((o) => {
      const label = (o.fulfillments ?? []).filter((x) => !x.canceled_at).flatMap((x) => x.labels ?? [])[0]
      return {
        id: o.id,
        number: o.display_id,
        created_at: o.created_at,
        status: humanStatus(o),
        total: Number(o.total),
        shipping_total: Number(o.shipping_total),
        paid_online: o.metadata?.payment_method === "tbank",
        delivery: o.shipping_methods?.[0]?.name ?? "",
        address: o.shipping_address?.address_1?.startsWith("Самовывоз") ? "" : [o.shipping_address?.city, o.shipping_address?.address_1].filter(Boolean).join(", "),
        tracking: label?.tracking_number ? { number: label.tracking_number, url: label.tracking_url } : null,
        items: (o.items ?? []).map((i) => ({
          id: i.id,
          title: i.product_title || i.title,
          size: i.variant_title || i.title,
          quantity: i.quantity,
          price: Number(i.unit_price),
          thumbnail: i.thumbnail ?? null,
          handle: i.product_handle ?? null,
        })),
      }
    }),
  })
}
