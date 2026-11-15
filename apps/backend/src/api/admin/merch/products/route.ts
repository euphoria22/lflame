import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { merchProducts } from "../../../../lib/merch/products"

/** Товары в наличии для раскладки по залу: категория, бренд, цвет, размеры, офлайн-балл и роль */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await merchProducts(req.scope))
}
