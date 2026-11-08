import { MedusaContainer } from "@medusajs/framework/types"
import { runMoyskladSync } from "../lib/moysklad/run"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import MoyskladModuleService from "../modules/moysklad/service"

/** Страховочная сверка каталога раз в 30 минут (ТЗ, п. 3.2). Основной канал — вебхуки. */
export default async function moyskladCatalogJob(container: MedusaContainer) {
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  if (!ms.options.scheduleEnabled) return
  await runMoyskladSync(container, "catalog", "schedule", { mode: "incremental" })
}

export const config = {
  name: "moysklad-catalog-sync",
  schedule: "*/30 * * * *",
}
