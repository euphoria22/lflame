import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { findCdekFulfillment, syncCdekFulfillment } from "../lib/delivery/cdek-sync"

/**
 * Раз в 5 минут сверяем отправки СДЭК за последние 30 дней, которые ещё не вручены:
 * номер накладной, статус, «Отправлена» / «Доставлена». Подстраховка к вебхуку СДЭК.
 */
export default async function cdekStatuses(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { data } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "data", "delivered_at", "canceled_at"],
    filters: { provider_id: "cdek_cdek", created_at: { $gte: new Date(Date.now() - 30 * 86400 * 1000) } },
    pagination: { take: 500 },
  })
  for (const row of data as { id: string; data: Record<string, unknown> | null; delivered_at: string | null; canceled_at: string | null }[]) {
    if (row.canceled_at || row.delivered_at || !row.data?.cdek_uuid || row.data?.cdek_error) continue
    try {
      const f = await findCdekFulfillment(container, { id: row.id })
      if (f) await syncCdekFulfillment(container, f)
    } catch (e) {
      logger.warn(`СДЭК: не удалось проверить отправку ${row.id}: ${(e as Error).message}`)
    }
  }
}

export const config = {
  name: "cdek-statuses",
  schedule: "*/5 * * * *",
}
