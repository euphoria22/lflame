import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { exportOrderToMoysklad, ordersExportEnabled } from "../lib/moysklad/export-order"

/**
 * Повтор выгрузки заказов, которые не ушли в МойСклад (ТЗ, п. 3.4: заказ никогда не теряется).
 * Раз в 10 минут: заказы за последние 7 дней без moysklad_order_id.
 */
export default async function moyskladOrdersRetry(container: MedusaContainer) {
  if (!ordersExportEnabled()) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const since = new Date(Date.now() - 7 * 86400 * 1000)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "metadata", "created_at"],
    filters: { created_at: { $gte: since } },
    pagination: { take: 200 },
  })
  for (const o of data as { id: string; metadata?: Record<string, unknown> | null; created_at: string }[]) {
    // Свежие заказы оставляем подписчику order.placed
    if (o.metadata?.moysklad_order_id || Date.now() - new Date(o.created_at).getTime() < 2 * 60 * 1000) continue
    await exportOrderToMoysklad(container, o.id)
  }
}

export const config = {
  name: "moysklad-orders-retry",
  schedule: "*/10 * * * *",
}
