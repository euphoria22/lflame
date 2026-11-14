import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffEmail } from "../../../../lib/admin/staff"
import { recomputeScores, saveConfig } from "../../../../lib/sort/engine"

/** Сохранить настройки новой версией и сразу пересчитать баллы */
export async function POST(req: AuthenticatedMedusaRequest<{ config?: unknown; note?: string }>, res: MedusaResponse) {
  try {
    const saved = await saveConfig(req.scope, req.body?.config, await staffEmail(req), String(req.body?.note ?? "").slice(0, 200) || null)
    const state = await recomputeScores(req.scope, { force: true })
    res.json({ ...saved, state })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
