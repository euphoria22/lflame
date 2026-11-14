import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffEmail } from "../../../../lib/admin/staff"
import { allRules, recomputeScores } from "../../../../lib/sort/engine"
import { createRules, RuleInput } from "../../../../lib/sort/rules"
import { revalidateCatalog } from "../../../../lib/brands/admin"

/** Создать ручное правило: закрепление, буст, понижение, дроп или режим «Распродажа» */
export async function POST(req: AuthenticatedMedusaRequest<RuleInput>, res: MedusaResponse) {
  try {
    const created = await createRules(req.scope, req.body ?? {}, await staffEmail(req))
    await recomputeScores(req.scope).catch(() => null)
    await revalidateCatalog()
    res.json({ created, rules: await allRules(req.scope) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
