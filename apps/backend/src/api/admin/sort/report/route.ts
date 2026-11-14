import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sortReport } from "../../../../lib/sort/admin"

/** Отчёт по неделям: CTR первой страницы, корзины на 100 визитов, охват каталога, доля топ-бренда */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await sortReport(req.scope))
}
