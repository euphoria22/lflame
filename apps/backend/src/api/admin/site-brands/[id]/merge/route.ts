import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { mergeBrands } from "../../../../../lib/brands/admin"

/** Объединить этот бренд с другим (into): товары и написания переходят туда, этот бренд удаляется. */
export async function POST(req: MedusaRequest<{ into?: string }>, res: MedusaResponse) {
  const into = req.body?.into
  if (!into) { res.status(400).json({ message: "Выберите бренд, с которым объединить" }); return }
  res.json(await mergeBrands(req.scope, req.params.id, into))
}
