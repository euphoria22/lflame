import { ExecArgs } from "@medusajs/framework/types"
import { refreshSales } from "../lib/moysklad/sales"

/**
 * Пересчитать продажи для сортировки «Популярные» сейчас (обычно — раз в сутки ночью):
 *   npx medusa exec ./src/scripts/sales-refresh.js
 */
export default async function salesRefresh({ container }: ExecArgs) {
  console.log(JSON.stringify(await refreshSales(container)))
}
