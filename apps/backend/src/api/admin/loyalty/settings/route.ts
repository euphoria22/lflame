import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getLoyaltySettings, saveLoyaltySettings } from "../../../../lib/loyalty/engine"
import { LoyaltySettings } from "../../../../lib/loyalty/rules"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({ settings: await getLoyaltySettings() })
}

export async function POST(req: MedusaRequest<Partial<LoyaltySettings>>, res: MedusaResponse) {
  try {
    res.json({ settings: await saveLoyaltySettings(req.body ?? {}) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
