import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { getLoyaltySettings, importSinceLast } from "../lib/loyalty/engine"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import MoyskladModuleService from "../modules/moysklad/service"

/** Раз в час: продажи и возвраты из МоегоСклада (офлайн-магазин и отгрузки) в журнал лояльности. */
export default async function loyaltyImport(container: MedusaContainer) {
  // Как и синхронизация каталога: работает, только когда включено расписание МС
  if (!container.resolve<MoyskladModuleService>(MOYSKLAD_MODULE).options.scheduleEnabled) return
  if (!(await getLoyaltySettings()).enabled) return
  try {
    const r = await importSinceLast(container)
    container.resolve(ContainerRegistrationKeys.LOGGER).info(`Лояльность: импорт из МС — документов ${r.docs}, новых ${r.created}, изменено ${r.updated}`)
  } catch (e) {
    container.resolve(ContainerRegistrationKeys.LOGGER).warn(`Лояльность: импорт из МС не удался: ${(e as Error).message}`)
  }
}

export const config = { name: "loyalty-import", schedule: "41 * * * *" }
