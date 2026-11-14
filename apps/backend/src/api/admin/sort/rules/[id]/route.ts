import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { revalidateCatalog } from "../../../../../lib/brands/admin"
import { allRules, recomputeScores } from "../../../../../lib/sort/engine"
import { endRule, RuleInput, updateRule } from "../../../../../lib/sort/rules"

async function done(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await recomputeScores(req.scope).catch(() => null)
  await revalidateCatalog()
  res.json({ rules: await allRules(req.scope) })
}

/** Правка правила: дата окончания, множитель, позиция */
export async function POST(req: AuthenticatedMedusaRequest<RuleInput>, res: MedusaResponse) {
  try {
    await updateRule(req.scope, req.params.id, req.body ?? {})
    await done(req, res)
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}

/** Завершить правило сейчас */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await endRule(req.scope, req.params.id)
  await done(req, res)
}
