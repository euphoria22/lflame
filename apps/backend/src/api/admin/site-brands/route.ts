import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listBrandRows } from "../../../lib/brands/admin"

/** Бренды для раздела «Бренды» в админке: с числом товаров. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ brands: await listBrandRows(req.scope) })
}
