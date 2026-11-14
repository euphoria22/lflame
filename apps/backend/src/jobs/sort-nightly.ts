import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { recomputeScores, refreshCardData } from "../lib/sort/engine"

/**
 * Ночной пересчёт умной сортировки, 03:00 по Москве (ТЗ сортировки, раздел 7): закупочные цены и коллекции из МоегоСклада,
 * события за 30 дней, баллы всех карточек. Упал — сайт работает на вчерашних баллах, в админке видно предупреждение.
 */
export default async function sortNightlyJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const data = await refreshCardData(container)
    if (data) logger.info(`Сортировка: данные из МоегоСклада — ${JSON.stringify(data)}`)
  } catch (e) {
    logger.warn(`Сортировка: закупочные цены и коллекции не обновлены (${(e as Error).message}) — считаем по прежним`)
  }
  try {
    const s = await recomputeScores(container)
    logger.info(`Сортировка: пересчитано ${s.cards} карточек, записано ${s.written}, ${s.ms} мс, профиль ${s.profile}`)
  } catch (e) {
    logger.error(`Сортировка: ночной пересчёт не выполнен: ${(e as Error).message}`)
  }
}

export const config = {
  name: "sort-nightly",
  schedule: "0 0 * * *",
}
