import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cdekTrackingUrl, getCdekOrder } from "../lib/delivery/cdek-orders"

/**
 * СДЭК присваивает номер накладной не сразу. Раз в 5 минут дописываем номер и трек-ссылку
 * в отправки за последние 14 дней; если СДЭК отклонил заказ — пишем причину в cdek_error.
 */
export default async function cdekNumbers(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillments = container.resolve(Modules.FULFILLMENT)
  const { data } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "data", "provider_id", "canceled_at"],
    filters: { provider_id: "cdek_cdek", created_at: { $gte: new Date(Date.now() - 14 * 86400 * 1000) } },
    pagination: { take: 200 },
  })
  for (const f of data as { id: string; data: Record<string, unknown> | null; canceled_at: string | null }[]) {
    const d = f.data ?? {}
    if (f.canceled_at || !d.cdek_uuid || d.cdek_number || d.cdek_error) continue
    try {
      const info = await getCdekOrder(String(d.cdek_uuid))
      const invalid = info.requests?.find((r) => r.type === "CREATE" && r.state === "INVALID")
      const num = info.entity?.cdek_number
      if (invalid) {
        const error = invalid.errors?.map((e) => e.message).join("; ") || "заказ отклонён"
        await fulfillments.updateFulfillment(f.id, { data: { ...d, cdek_error: error } })
        logger.warn(`СДЭК отклонил отправку ${f.id}: ${error}`)
      } else if (num) {
        await fulfillments.updateFulfillment(f.id, {
          data: { ...d, cdek_number: num },
          labels: [{ tracking_number: num, tracking_url: cdekTrackingUrl(num), label_url: `/admin/cdek/label/${d.cdek_uuid}` }],
        })
      }
    } catch (e) {
      logger.warn(`СДЭК: не удалось проверить отправку ${f.id}: ${(e as Error).message}`)
    }
  }
}

export const config = {
  name: "cdek-numbers",
  schedule: "*/5 * * * *",
}
