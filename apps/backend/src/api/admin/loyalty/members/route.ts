import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../modules/loyalty/service"
import { getLoyaltySettings, lastImportAt } from "../../../../lib/loyalty/engine"
import { importState } from "../run/route"

type M = { id: string; phone: string; name: string | null; email: string | null; total: number; level: string; level_override: string | null }

/** Участники: поиск по телефону / имени / email, фильтр по уровню, сводка по уровням. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = String((req.query as { q?: string }).q ?? "").trim().toLowerCase()
  const level = String((req.query as { level?: string }).level ?? "")
  const svc = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const all = (await svc.listLoyaltyMembers({}, { take: 100000, order: { total: "DESC" } })) as unknown as M[]
  const settings = await getLoyaltySettings()
  const counts = Object.fromEntries(settings.tiers.map((t) => [t.code, 0]))
  for (const m of all) counts[m.level] = (counts[m.level] ?? 0) + 1
  const digits = q.replace(/\D/g, "")
  const rows = all.filter((m) => (!level || m.level === level) && (!q
    || (digits.length >= 3 && m.phone.includes(digits))
    || (m.name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q)))
  res.json({
    members: rows.slice(0, 200),
    total: rows.length,
    counts,
    imported_at: (await lastImportAt())?.toISOString() ?? null,
    import: importState(),
  })
}
