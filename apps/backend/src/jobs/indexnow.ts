import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { changedProductUrls, indexNowEnabled, submitUrls } from "../lib/seo/indexnow"

let lastRun: Date | null = null

/** Раз в 15 минут: новые и изменённые товары — в Яндекс через IndexNow (только при INDEXING=on). */
export default async function indexNowJob(container: MedusaContainer) {
  const now = new Date()
  // После перезапуска — изменения за последние 20 минут
  const since = lastRun ?? new Date(now.getTime() - 20 * 60 * 1000)
  lastRun = now
  if (!indexNowEnabled()) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  await submitUrls(await changedProductUrls(container, since), logger)
}

export const config = {
  name: "indexnow",
  schedule: "*/15 * * * *",
}
