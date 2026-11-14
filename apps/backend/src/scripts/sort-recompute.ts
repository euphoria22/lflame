import { ExecArgs } from "@medusajs/framework/types"
import { recomputeScores, refreshCardData } from "../lib/sort/engine"

/** Пересчитать баллы умной сортировки вручную: npx medusa exec ./src/scripts/sort-recompute.ts */
export default async function sortRecompute({ container }: ExecArgs) {
  const data = await refreshCardData(container).catch((e: Error) => ({ error: e.message }))
  console.log("МойСклад (закупка, коллекции):", JSON.stringify(data))
  console.log("Пересчёт:", JSON.stringify(await recomputeScores(container, { force: true })))
}
