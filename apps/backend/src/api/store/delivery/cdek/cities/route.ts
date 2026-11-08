import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cdekSuggestCities } from "../../../../../lib/delivery/cdek-client"

/** Подсказки городов СДЭК для оформления заказа. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = String((req.query as { q?: string }).q ?? "").trim().slice(0, 60)
  if (q.length < 2) {
    res.json({ cities: [] })
    return
  }
  try {
    res.json({ cities: await cdekSuggestCities(q) })
  } catch {
    res.status(502).json({ cities: [], message: "СДЭК временно недоступен" })
  }
}
