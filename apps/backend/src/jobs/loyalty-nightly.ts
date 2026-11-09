import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { nightly } from "../lib/loyalty/engine"

/** Каждую ночь: зачёт покупок с истёкшей задержкой, пересчёт уровней, предупреждения о понижении. */
export default async function loyaltyNightly(container: MedusaContainer) {
  const r = await nightly(container)
  container.resolve(ContainerRegistrationKeys.LOGGER).info(`Лояльность: засчитано ${r.credited}, участников ${r.members}, предупреждений ${r.warned}`)
}

// 03:17 по Москве (00:17 UTC)
export const config = { name: "loyalty-nightly", schedule: "17 0 * * *" }
