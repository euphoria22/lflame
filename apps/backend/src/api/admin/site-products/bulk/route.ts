import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Flag, setFlags } from "../../../../lib/catalog/admin-flags"

type Body = { ids?: string[]; set?: Partial<Record<Flag, boolean>> }

/** Массово включить или выключить флажки: предзаказ, новинка, закрепить, Outlet, без скидок Club. */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x): x is string => typeof x === "string") : []
  if (!ids.length) {
    res.status(400).json({ message: "Не выбраны товары" })
    return
  }
  if (ids.length > 2000) {
    res.status(400).json({ message: "Слишком много товаров за раз" })
    return
  }
  res.json({ updated: await setFlags(req.scope, ids, req.body?.set ?? {}) })
}
