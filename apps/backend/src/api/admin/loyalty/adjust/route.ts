import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { manualAdjust } from "../../../../lib/loyalty/engine"

/** Ручная корректировка суммы (с причиной, пишется в журнал). */
export async function POST(req: AuthenticatedMedusaRequest<{ phone?: string; amount?: number; reason?: string }>, res: MedusaResponse) {
  try {
    const b = req.body ?? {}
    const amount = Number(b.amount)
    if (!Number.isFinite(amount) || !amount || Math.abs(amount) > 10_000_000) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Сумма — число, не 0")
    res.json({ member: await manualAdjust(req.scope, String(b.phone ?? ""), amount, String(b.reason ?? ""), req.auth_context.actor_id) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
