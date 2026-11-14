import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storeSort } from "../../../../lib/sort/engine"

/** Настройки разведения соседей, действующие закрепления и версия порядка — витрина собирает по ним листинги */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await storeSort(req.scope))
}
