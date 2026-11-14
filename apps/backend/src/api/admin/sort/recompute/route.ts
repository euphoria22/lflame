import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { recomputeScores, refreshCardData } from "../../../../lib/sort/engine"

/** Пересчитать баллы сейчас (кнопка в админке); with_ms — заодно обновить закупочные цены, коллекции и утеплённость из МоегоСклада */
export async function POST(req: AuthenticatedMedusaRequest<{ with_ms?: boolean }>, res: MedusaResponse) {
  try {
    const data = req.body?.with_ms ? await refreshCardData(req.scope).catch((e: Error) => ({ error: e.message })) : undefined
    res.json({ state: await recomputeScores(req.scope, { force: true }), data })
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}
