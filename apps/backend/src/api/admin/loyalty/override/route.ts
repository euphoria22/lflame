import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setOverride } from "../../../../lib/loyalty/engine"
import { normalizePhone } from "../../../../lib/loyalty/rules"

/** Ручной уровень поверх расчёта (например, VIP) или его снятие (level: null). */
export async function POST(req: MedusaRequest<{ phone?: string; level?: string | null; reason?: string }>, res: MedusaResponse) {
  const b = req.body ?? {}
  const phone = normalizePhone(b.phone)
  if (!phone) {
    res.status(400).json({ message: "Неверный телефон" })
    return
  }
  if (b.level && !String(b.reason ?? "").trim()) {
    res.status(400).json({ message: "Укажите причину" })
    return
  }
  try {
    res.json({ member: await setOverride(req.scope, phone, b.level || null, b.reason?.trim() || null) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
