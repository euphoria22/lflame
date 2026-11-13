import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { giftOffsetReceipt, onGiftOrderCanceled, onGiftOrderPlaced } from "../lib/gift-cards/orders"

/** Подарочные карты: заказ создан — списать с карты (и чек зачёта аванса, если оплачен картой целиком); отменён — вернуть на карту. */
export default async function giftCardOrders({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    if (event.name === "order.placed") {
      await onGiftOrderPlaced(container, event.data.id, logger)
      await giftOffsetReceipt(container, event.data.id, logger)
    }
    else if (event.name === "order.canceled") await onGiftOrderCanceled(container, event.data.id, logger)
  } catch (e) {
    logger.warn(`Подарочные карты: ${event.name} ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: ["order.placed", "order.canceled"] }
