import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { queueTick } from "../lib/telegram/channel"

/** Посты в Telegram по расписанию (окно и интервал — на странице «Telegram» в админке). */
export default async function telegramQueueJob(container: MedusaContainer) {
  await queueTick(container, container.resolve(ContainerRegistrationKeys.LOGGER))
}

export const config = {
  name: "telegram-queue",
  schedule: "* * * * *",
}
