import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { checklistsTick } from "../lib/merch/checklists"

/** Мерчендайзинг: повторяющиеся чек-листы в рабочий чат по расписанию (lib/merch/checklists.ts) */
export default async function merchChecklistsJob(container: MedusaContainer) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  await checklistsTick(container, log).catch((e: Error) => log.warn(`Чек-листы: ${e.message}`))
}

export const config = {
  name: "merch-checklists",
  schedule: "* * * * *",
}
