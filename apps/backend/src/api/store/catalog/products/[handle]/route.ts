import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadCatalogProduct } from "../../../../../lib/catalog/store-catalog"

/** Карточка товара (ТЗ, п. 6.3). 404, если товара нет или он не опубликован. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const product = await loadCatalogProduct(req.scope, (req.params as { handle: string }).handle)
  if (!product) {
    res.status(404).json({ message: "Товар не найден" })
    return
  }
  res.json({ product })
}
