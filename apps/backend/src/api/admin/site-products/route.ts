import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listSiteProducts } from "../../../lib/catalog/admin-flags"

/** Товары с флажками сайта — для массовой правки в админке. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ products: await listSiteProducts(req.scope) })
}
