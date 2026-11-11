import { MedusaContainer } from "@medusajs/framework/types"
import { refreshSales } from "../lib/moysklad/sales"

/** Продажи за 60 дней для сортировки «Популярные»: раз в сутки ночью (по Москве ~05:40). */
export default async function moyskladSalesJob(container: MedusaContainer) {
  await refreshSales(container)
}

export const config = {
  name: "moysklad-sales",
  schedule: "40 2 * * *",
}
