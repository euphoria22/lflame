import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cdekPoints } from "../../../../../lib/delivery/cdek-client"

/** Пункты выдачи СДЭК в городе. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const code = Number((req.query as { city_code?: string }).city_code)
  if (!code) {
    res.json({ points: [] })
    return
  }
  try {
    res.json({ points: await cdekPoints(code) })
  } catch {
    res.status(502).json({ points: [], message: "СДЭК временно недоступен" })
  }
}
