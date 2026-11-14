import { MedusaContainer } from "@medusajs/framework/types"
import { refreshSales } from "../lib/moysklad/sales"

/** Продажи за 30 дней для сортировки «Популярные»: раз в сутки ночью, 02:40 по Москве — до пересчёта сортировки в 03:00. */
export default async function moyskladSalesJob(container: MedusaContainer) {
  await refreshSales(container)
}

export const config = {
  name: "moysklad-sales",
  schedule: "40 23 * * *",
}
