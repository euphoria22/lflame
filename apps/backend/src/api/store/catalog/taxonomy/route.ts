import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadTaxonomy } from "../../../../lib/catalog/store-catalog"

/** Бренды и категории с описаниями и SEO-полями (ТЗ, п. 7.5, 7.11). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await loadTaxonomy(req.scope))
}
