import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadCatalogItems } from "../../../../lib/catalog/store-catalog"
import { attachScores } from "../../../../lib/sort/engine"

/**
 * Все товары витрины в лёгком виде (ТЗ, п. 6.2). Кэшируется на стороне витрины.
 * К карточкам добавляется балл умной сортировки; точные остатки и внутренние поля наружу не отдаём.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const items = (await attachScores(req.scope, await loadCatalogItems(req.scope)))
    .map(({ stock_units: _u, model_units: _m, external_id: _e, sales_units: _s, warmth: _w, ...i }) => i)
  res.json({ items, count: items.length, generated_at: new Date().toISOString() })
}
