import { MedusaContainer } from "@medusajs/framework/types"
import { runMoyskladSync } from "../lib/moysklad/run"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import MoyskladModuleService from "../modules/moysklad/service"

/** Сверка всех остатков раз в 10 минут (ТЗ, п. 3.3). */
export default async function moyskladStockJob(container: MedusaContainer) {
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  if (!ms.options.scheduleEnabled) return
  await runMoyskladSync(container, "stock", "schedule")
}

export const config = {
  name: "moysklad-stock-sync",
  schedule: "*/10 * * * *",
}
