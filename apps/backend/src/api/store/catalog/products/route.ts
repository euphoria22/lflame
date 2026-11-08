import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadCatalogItems } from "../../../../lib/catalog/store-catalog"

/** Все товары витрины в лёгком виде (ТЗ, п. 6.2). Кэшируется на стороне витрины. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const items = await loadCatalogItems(req.scope)
  res.json({ items, count: items.length, generated_at: new Date().toISOString() })
}
