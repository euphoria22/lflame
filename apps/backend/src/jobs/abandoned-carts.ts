import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { abandonedTick } from "../lib/abandoned/abandoned"

/** Письма о брошенных корзинах — раз в 15 минут (настройки — «Рассылка» в админке) */
export default async function abandonedCartsJob(container: MedusaContainer) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  await abandonedTick(container, log).catch((e: Error) => log.warn(`Брошенные корзины: ${e.message}`))
}

export const config = {
  name: "abandoned-carts",
  schedule: "*/15 * * * *",
}
