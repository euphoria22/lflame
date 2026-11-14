import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { whyListing } from "../../../../lib/sort/admin"
import { Zone, ZONES } from "../../../../lib/sort/config"

/** «Почему он здесь»: листинг с позициями, компонентами балла, множителями и причиной каждой позиции */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const zone = (ZONES as string[]).includes(String(req.query.zone ?? "")) ? (req.query.zone as Zone) : "central"
  const { rows, total } = await whyListing(req.scope, String(req.query.listing || "all"), zone)
  const q = String(req.query.q ?? "").trim().toLowerCase()
  const take = Math.min(500, Number(req.query.take) || 96)
  res.json({ total, rows: q ? rows.filter((r) => `${r.title} ${r.brand ?? ""}`.toLowerCase().includes(q)).slice(0, take) : rows.slice(0, take) })
}
