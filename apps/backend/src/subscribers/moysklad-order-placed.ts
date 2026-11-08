import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { exportOrderToMoysklad, ordersExportEnabled } from "../lib/moysklad/export-order"

/** Новый заказ сайта -> МойСклад (ТЗ, п. 3.4). Ошибки повторяет задача moysklad-orders-retry. */
export default async function moyskladOrderPlaced({ event, container }: SubscriberArgs<{ id: string }>) {
  if (!ordersExportEnabled()) return
  await exportOrderToMoysklad(container, event.data.id)
}

export const config: SubscriberConfig = { event: "order.placed" }
