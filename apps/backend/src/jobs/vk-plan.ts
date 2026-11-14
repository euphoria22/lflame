import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { vkPlanTick } from "../lib/vk/plan"

/** ВКонтакте: отложенные записи на неделю вперёд — сверка, замена проданного, заполнение свободных слотов (lib/vk/plan.ts) */
export default async function vkPlanJob(container: MedusaContainer) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  await vkPlanTick(container, log).catch((e: Error) => log.warn(`ВКонтакте: отложка не обновлена: ${e.message}`))
}

export const config = {
  name: "vk-plan",
  schedule: "3-59/10 * * * *",
}
