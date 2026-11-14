import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffEmail } from "../../../../lib/admin/staff"
import { configByVersion, recomputeScores, saveConfig } from "../../../../lib/sort/engine"

/** Откат: настройки выбранной версии сохраняются новой версией, баллы пересчитываются */
export async function POST(req: AuthenticatedMedusaRequest<{ version?: number }>, res: MedusaResponse) {
  const v = Number(req.body?.version)
  const config = Number.isInteger(v) ? await configByVersion(req.scope, v) : null
  if (!config) { res.status(404).json({ message: "Версия не найдена" }); return }
  const saved = await saveConfig(req.scope, config, await staffEmail(req), `откат к версии ${v}`)
  const state = await recomputeScores(req.scope, { force: true })
  res.json({ ...saved, state })
}
