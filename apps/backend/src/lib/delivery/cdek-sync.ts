import { createHash } from "node:crypto"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow, createOrderShipmentWorkflow, markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows"
import { cdekConfig } from "./cdek-client"
import { cdekTrackingUrl, getCdekOrder } from "./cdek-orders"

/**
 * Статусы заказов СДЭК -> отправки Medusa (ТЗ, п. 5.3).
 * Посылку приняли в СДЭК -> отправка «Отправлена»; вручили покупателю -> «Доставлена».
 * Источник статусов — вебхук СДЭК (/hooks/cdek/<секрет>) и проверка раз в 5 минут.
 */

export const CDEK_STATUS_NAMES: Record<string, string> = {
  CREATED: "Создан",
  ACCEPTED: "Принят",
  INVALID: "Ошибка в заказе",
  RECEIVED_AT_SHIPMENT_WAREHOUSE: "Принят в СДЭК от магазина",
  READY_TO_SHIP_AT_SENDING_OFFICE: "Готов к отправке",
  READY_FOR_SHIPMENT_IN_TRANSIT_CITY: "Готов к отправке в транзитном городе",
  RETURNED_TO_SENDER_CITY_WAREHOUSE: "Возвращён на склад отправителя",
  TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY: "Передан перевозчику",
  SENT_TO_TRANSIT_CITY: "Отправлен в транзитный город",
  ACCEPTED_IN_TRANSIT_CITY: "Встречен в транзитном городе",
  ACCEPTED_AT_TRANSIT_WAREHOUSE: "Принят на транзитном складе",
  SENT_TO_RECIPIENT_CITY: "Отправлен в город получателя",
  ACCEPTED_IN_RECIPIENT_CITY: "Прибыл в город получателя",
  ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE: "Принят на складе доставки",
  ACCEPTED_AT_PICK_UP_POINT: "Ждёт в пункте выдачи",
  TAKEN_BY_COURIER: "Выдан курьеру",
  RETURNED_TO_RECIPIENT_CITY_WAREHOUSE: "Возвращён на склад доставки",
  DELIVERED: "Вручён",
  NOT_DELIVERED: "Не вручён",
  REMOVED: "Удалён",
}

/** Статусы, после которых посылка считается отправленной (уже у СДЭК). */
const SHIPPED = new Set([
  "RECEIVED_AT_SHIPMENT_WAREHOUSE", "READY_TO_SHIP_AT_SENDING_OFFICE", "TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY",
  "SENT_TO_TRANSIT_CITY", "ACCEPTED_IN_TRANSIT_CITY", "ACCEPTED_AT_TRANSIT_WAREHOUSE", "READY_FOR_SHIPMENT_IN_TRANSIT_CITY",
  "SENT_TO_RECIPIENT_CITY", "ACCEPTED_IN_RECIPIENT_CITY", "ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE", "ACCEPTED_AT_PICK_UP_POINT",
  "TAKEN_BY_COURIER", "DELIVERED", "NOT_DELIVERED",
])

export const cdekShipped = (code: string) => SHIPPED.has(code)

/** Секрет в адресе вебхука: СДЭК не подписывает уведомления, поэтому адрес должен быть неугадываемым. */
export function cdekWebhookSecret(): string {
  const base = process.env.CDEK_WEBHOOK_SECRET || `${cdekConfig().clientSecret}:${process.env.COOKIE_SECRET ?? ""}`
  return createHash("sha256").update(base).digest("hex").slice(0, 24)
}

type FulfillmentRow = {
  id: string
  data: Record<string, unknown> | null
  shipped_at: string | null
  delivered_at: string | null
  canceled_at: string | null
  items?: { line_item_id: string | null; quantity: number }[]
  labels?: { tracking_number: string; tracking_url: string; label_url: string }[]
  order?: { id: string } | null
}

const FIELDS = ["id", "data", "shipped_at", "delivered_at", "canceled_at", "items.line_item_id", "items.quantity", "labels.tracking_number", "labels.tracking_url", "labels.label_url", "order.id"]

export async function findCdekFulfillment(container: MedusaContainer, filter: { id?: string; uuid?: string }): Promise<FulfillmentRow | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  if (filter.id) {
    const { data } = await query.graph({ entity: "fulfillment", fields: FIELDS, filters: { id: filter.id } })
    return (data[0] as unknown as FulfillmentRow) ?? null
  }
  const { data } = await query.graph({
    entity: "fulfillment",
    fields: FIELDS,
    filters: { provider_id: "cdek_cdek", created_at: { $gte: new Date(Date.now() - 120 * 86400 * 1000) } },
    pagination: { take: 1000 },
  })
  return ((data as unknown as FulfillmentRow[]).find((f) => f.data?.cdek_uuid === filter.uuid)) ?? null
}

/** Применить статус СДЭК к отправке. */
export async function applyCdekStatus(
  container: MedusaContainer,
  f: FulfillmentRow,
  update: { code: string; at?: string; cdek_number?: string | null; error?: string | null }
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillments = container.resolve(Modules.FULFILLMENT)
  if (f.canceled_at) return
  const d = f.data ?? {}
  const num = update.cdek_number || (d.cdek_number as string | null) || null
  const patch: Record<string, unknown> = {
    ...d,
    cdek_status: update.code,
    cdek_status_name: CDEK_STATUS_NAMES[update.code] ?? update.code,
    cdek_status_at: update.at ?? new Date().toISOString(),
  }
  if (num) patch.cdek_number = num
  if (update.error) patch.cdek_error = update.error
  const needLabel = num && !f.labels?.length
  await fulfillments.updateFulfillment(f.id, {
    data: patch,
    ...(needLabel ? { labels: [{ tracking_number: num, tracking_url: cdekTrackingUrl(num), label_url: `/admin/cdek/label/${d.cdek_uuid}` }] } : {}),
  })

  const orderId = f.order?.id
  if (!orderId) return
  try {
    if (cdekShipped(update.code) && !f.shipped_at) {
      await createOrderShipmentWorkflow(container).run({
        input: {
          order_id: orderId,
          fulfillment_id: f.id,
          items: (f.items ?? []).filter((i) => i.line_item_id).map((i) => ({ id: i.line_item_id as string, quantity: i.quantity })),
        },
      })
      logger.info(`СДЭК: отправка ${f.id} отмечена отправленной (${update.code})`)
    }
    if (update.code === "DELIVERED" && !f.delivered_at) {
      await markOrderFulfillmentAsDeliveredWorkflow(container).run({ input: { orderId, fulfillmentId: f.id } })
      logger.info(`СДЭК: отправка ${f.id} доставлена`)
      // Оплата при получении: СДЭК забрал деньги у покупателя — отмечаем оплату полученной
      if (d.cod) await captureCodPayments(container, orderId)
    }
  } catch (e) {
    logger.warn(`СДЭК: не удалось обновить статус отправки ${f.id}: ${(e as Error).message}`)
  }
}

/** Запросить заказ в СДЭК и применить его текущий статус. */
export async function syncCdekFulfillment(container: MedusaContainer, f: FulfillmentRow): Promise<void> {
  const uuid = f.data?.cdek_uuid
  if (!uuid || f.canceled_at) return
  const info = await getCdekOrder(String(uuid)) as Awaited<ReturnType<typeof getCdekOrder>> & {
    entity?: { statuses?: { code: string; date_time: string }[] }
  }
  const invalid = info.requests?.find((r) => r.type === "CREATE" && r.state === "INVALID")
  const statuses = [...(info.entity?.statuses ?? [])].sort((a, b) => b.date_time.localeCompare(a.date_time))
  const latest = statuses[0]
  if (invalid) {
    await applyCdekStatus(container, f, { code: "INVALID", error: invalid.errors?.map((e) => e.message).join("; ") || "заказ отклонён" })
  } else if (latest && (latest.code !== f.data?.cdek_status || (info.entity?.cdek_number && !f.data?.cdek_number))) {
    await applyCdekStatus(container, f, { code: latest.code, at: latest.date_time, cdek_number: info.entity?.cdek_number })
  }
}

async function captureCodPayments(container: MedusaContainer, orderId: string): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["payment_collections.payments.id", "payment_collections.payments.provider_id", "payment_collections.payments.captured_at", "payment_collections.payments.canceled_at"],
    filters: { id: orderId },
  })
  const payments = ((data[0] as { payment_collections?: { payments?: { id: string; provider_id: string; captured_at: string | null; canceled_at: string | null }[] }[] })?.payment_collections ?? [])
    .flatMap((c) => c.payments ?? [])
    .filter((p) => p.provider_id === "pp_system_default" && !p.captured_at && !p.canceled_at)
  for (const p of payments) await capturePaymentWorkflow(container).run({ input: { payment_id: p.id } })
}
