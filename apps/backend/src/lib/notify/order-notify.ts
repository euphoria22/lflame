import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendMail } from "./mailer"
import { sendTelegram } from "./telegram"
import { MailOrder, OrderMailKind, orderMail, shopOrderMessage } from "./templates"

type Row = {
  id: string
  display_id: number
  email: string | null
  total: unknown
  item_total: unknown
  item_subtotal?: unknown
  shipping_total: unknown
  discount_total: unknown
  metadata: Record<string, unknown> | null
  shipping_address?: { first_name?: string; last_name?: string; phone?: string; address_1?: string; city?: string; postal_code?: string } | null
  shipping_methods?: { name: string }[]
  items?: { product_title?: string; title: string; variant_title?: string | null; quantity: number; unit_price: unknown; variant?: { product?: { metadata?: Record<string, unknown> | null } | null } | null }[]
  fulfillments?: { id: string; canceled_at: string | null; labels?: { tracking_number: string; tracking_url: string }[] }[]
  credit_lines?: { amount: unknown; reference: string | null }[]
}

export async function loadMailOrder(container: MedusaContainer, orderId: string, fulfillmentId?: string): Promise<MailOrder | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "email", "total", "item_total", "item_subtotal", "shipping_total", "discount_total", "metadata",
      "shipping_address.first_name", "shipping_address.last_name", "shipping_address.phone", "shipping_address.address_1",
      "shipping_address.city", "shipping_address.postal_code", "shipping_methods.name",
      "items.product_title", "items.title", "items.variant_title", "items.quantity", "items.unit_price", "items.variant.product.metadata",
      "fulfillments.id", "fulfillments.canceled_at", "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url",
      "credit_lines.amount", "credit_lines.reference",
    ],
    filters: { id: orderId },
  })
  const o = data[0] as unknown as Row | undefined
  if (!o) return null
  const a = o.shipping_address ?? {}
  const f = (o.fulfillments ?? []).filter((x) => !x.canceled_at).find((x) => !fulfillmentId || x.id === fulfillmentId)
  const label = f?.labels?.[0]
  return {
    display_id: o.display_id,
    email: o.email,
    total: Number(o.total),
    // «Товары» — до промокода, скидка промокода — отдельной строкой
    item_total: Number(o.item_subtotal ?? o.item_total),
    shipping_total: Number(o.shipping_total),
    discount_total: Number(o.discount_total ?? 0),
    payment_method: (o.metadata?.payment_method as string) ?? null,
    gift_card_total: (o.credit_lines ?? []).filter((l) => l.reference === "gift_card").reduce((s, l) => s + Number(l.amount), 0),
    promo_code: (o.metadata?.promo_code as string) ?? null,
    customer_name: [[a.first_name, a.last_name].filter(Boolean).join(" "), a.phone].filter(Boolean).join(", "),
    shipping_name: o.shipping_methods?.[0]?.name ?? "",
    // Самовывоз: адрес магазина уже есть в названии способа
    address: a.address_1?.startsWith("Самовывоз") ? "" : [a.city, a.address_1, a.postal_code].filter(Boolean).join(", "),
    items: (o.items ?? []).map((i) => ({
      title: i.product_title || i.title, variant: i.variant_title || i.title, quantity: i.quantity, unit_price: Number(i.unit_price),
      preorder: Boolean(i.variant?.product?.metadata?.preorder),
      preorder_date: (i.variant?.product?.metadata?.preorder_date as string | null | undefined) ?? null,
    })),
    tracking: label?.tracking_number ? { number: label.tracking_number, url: label.tracking_url } : null,
  }
}

/** Письмо покупателю. Ошибки отправки не ломают заказ — только запись в журнал. */
export async function notifyCustomer(container: MedusaContainer, kind: OrderMailKind, orderId: string, fulfillmentId?: string): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const o = await loadMailOrder(container, orderId, fulfillmentId)
    if (!o?.email) return
    await sendMail(orderMail(kind, o), logger)
  } catch (e) {
    logger.warn(`Письмо «${kind}» по заказу ${orderId} не отправлено: ${(e as Error).message}`)
  }
}

/** Магазину о новом заказе: Telegram и письмо на SHOP_EMAIL. */
export async function notifyShop(container: MedusaContainer, orderId: string): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const o = await loadMailOrder(container, orderId)
    if (!o) return
    const backend = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
    const msg = shopOrderMessage(o, `${backend}/app/orders/${orderId}`)
    await sendTelegram(msg, logger)
    if (process.env.SHOP_EMAIL) {
      const text = msg.replace(/<[^>]+>/g, "")
      await sendMail({ to: process.env.SHOP_EMAIL, subject: `Новый заказ № ${o.display_id} — ${Math.round(o.total)} ₽`, text, html: `<pre style="font-family:inherit;font-size:14px">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>` }, logger)
    }
  } catch (e) {
    logger.warn(`Уведомление магазину по заказу ${orderId} не отправлено: ${(e as Error).message}`)
  }
}

/** Заказ отправки (fulfillment) -> id заказа. */
export async function orderIdByFulfillment(container: MedusaContainer, fulfillmentId: string): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "fulfillment", fields: ["id", "order.id"], filters: { id: fulfillmentId } })
  return (data[0] as { order?: { id: string } } | undefined)?.order?.id ?? null
}
