import { MedusaContainer } from "@medusajs/framework/types"
import { notifyRestocked } from "../lib/restock/restock"

/** «Сообщить о поступлении»: через 5 минут после каждой сверки остатков с МС (она — каждые 10 минут). */
export default async function restockNotifyJob(container: MedusaContainer) {
  await notifyRestocked(container)
}

export const config = {
  name: "restock-notify",
  schedule: "5-59/10 * * * *",
}
