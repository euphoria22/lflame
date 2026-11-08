import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyCustomer, notifyShop, orderIdByFulfillment } from "../lib/notify/order-notify"

/** Письма покупателю и уведомления магазину по событиям заказа (ТЗ, п. 6.6). */
export default async function orderNotifications({ event, container }: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  const { id, no_notification } = event.data
  if (no_notification) return
  switch (event.name) {
    case "order.placed":
      await Promise.all([notifyCustomer(container, "placed", id), notifyShop(container, id)])
      break
    case "order.canceled":
      await notifyCustomer(container, "canceled", id)
      break
    case "shipment.created":
    case "delivery.created": {
      const orderId = await orderIdByFulfillment(container, id)
      if (orderId) await notifyCustomer(container, event.name === "shipment.created" ? "shipped" : "delivered", orderId, id)
      break
    }
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled", "shipment.created", "delivery.created"],
}
