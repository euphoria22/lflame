import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendDue } from "../lib/gift-cards/engine"

/** Подарочные карты с отложенной отправкой: письмо получателю в выбранный день (10:00 по Омску). */
export default async function giftCardMailsJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const n = await sendDue(container, logger)
  if (n) logger.info(`Подарочные карты: отправлено писем: ${n}`)
}

export const config = {
  name: "gift-card-mails",
  schedule: "*/10 * * * *",
}
