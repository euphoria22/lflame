import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { shiftsTick } from "../lib/shifts/bot"

/** График смен: утреннее напоминание в рабочий чат и ответы бота на /smena, /grafik (lib/shifts/bot.ts) */
export default async function shiftsBotJob(container: MedusaContainer) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  await shiftsTick(log).catch((e: Error) => log.warn(`Смены: ${e.message}`))
}

export const config = {
  name: "shifts-bot",
  schedule: "* * * * *",
}
