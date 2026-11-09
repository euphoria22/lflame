import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { onOrderCanceled, onOrderDelivered } from "../lib/loyalty/engine"
import { orderIdByFulfillment } from "../lib/notify/order-notify"

/** Лояльность: заказ получен -> ожидает зачёта; отменён -> запись отменяется (ТЗ, п. 6.7). */
export default async function loyaltyOrders({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    if (event.name === "delivery.created") {
      const orderId = await orderIdByFulfillment(container, event.data.id)
      if (orderId) await onOrderDelivered(container, orderId)
    } else if (event.name === "order.canceled") {
      await onOrderCanceled(container, event.data.id)
    }
  } catch (e) {
    logger.warn(`Лояльность: ${event.name} ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: ["delivery.created", "order.canceled"] }
