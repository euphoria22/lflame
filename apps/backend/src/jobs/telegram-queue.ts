import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NETS, queueTick } from "../lib/telegram/channel"

/** Посты в Telegram и ВКонтакте по расписанию (у каждой сети своё окно и интервал — на странице «Telegram» в админке). */
export default async function telegramQueueJob(container: MedusaContainer) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  const now = new Date()
  for (const net of NETS) await queueTick(container, log, now, net)
}

export const config = {
  name: "telegram-queue",
  schedule: "* * * * *",
}
