import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { syncRetailSales } from "../lib/merch/retail"

/** Мерчендайзинг: розничные продажи магазина по дням и размерам — каждую ночь (03:20 по Омску) */
export default async function merchRetailJob(container: MedusaContainer) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  await syncRetailSales(container).catch((e: Error) => log.warn(`Мерчендайзинг: продажи магазина не обновлены: ${e.message}`))
}

export const config = {
  name: "merch-retail",
  schedule: "20 21 * * *",
}
