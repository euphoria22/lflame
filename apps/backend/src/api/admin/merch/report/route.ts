import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { merchReport } from "../../../../lib/merch/report"
import { syncRetailSales } from "../../../../lib/merch/retail"

/** Отчёт эффективности выкладки; ?layout_id= — по варианту (по умолчанию текущий) */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    res.json(await merchReport(req.scope, (req.query.layout_id as string) || undefined))
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}

/** Обновить продажи магазина из МоегоСклада прямо сейчас (обычно — каждую ночь) */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    res.json(await syncRetailSales(req.scope))
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
