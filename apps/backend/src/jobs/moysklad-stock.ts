import { MedusaContainer } from "@medusajs/framework/types"
import { runMoyskladSync } from "../lib/moysklad/run"
import { recomputeScores } from "../lib/sort/engine"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import MoyskladModuleService from "../modules/moysklad/service"

/** Сверка всех остатков раз в 10 минут (ТЗ, п. 3.3). */
export default async function moyskladStockJob(container: MedusaContainer) {
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  if (!ms.options.scheduleEnabled) return
  await runMoyskladSync(container, "stock", "schedule")
  // Остатки изменились — компонент «Размеры» и множители карточек пересчитываются сразу (запись — только по изменившимся)
  await recomputeScores(container).catch(() => null)
}

export const config = {
  name: "moysklad-stock-sync",
  schedule: "*/10 * * * *",
}
