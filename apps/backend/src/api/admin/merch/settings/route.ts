import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadMerchSettings, saveMerchSettings } from "../../../../lib/merch/settings"

/** Правила выкладки: уровни брендов, плотность и число размеров по уровню */
export async function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ settings: await loadMerchSettings() })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    res.json({ settings: await saveMerchSettings(req.body) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
