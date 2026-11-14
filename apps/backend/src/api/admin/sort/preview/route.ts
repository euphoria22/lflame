import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { previewListing } from "../../../../lib/sort/admin"
import { validateConfig, Zone, ZONES } from "../../../../lib/sort/config"

/** Предпросмотр листинга: «было» по действующим настройкам и «станет» по черновику — до сохранения */
export async function POST(req: AuthenticatedMedusaRequest<{ config?: unknown; listing?: string; zone?: string }>, res: MedusaResponse) {
  const { value, error } = validateConfig(req.body?.config)
  if (!value) { res.status(400).json({ message: error }); return }
  const zone = (ZONES as string[]).includes(req.body?.zone ?? "") ? (req.body!.zone as Zone) : "central"
  res.json(await previewListing(req.scope, String(req.body?.listing || "all"), value, zone))
}
