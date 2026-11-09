import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getLoyaltySettings } from "../../../../lib/loyalty/engine"
import { sortedTiers } from "../../../../lib/loyalty/rules"

/** Публичное описание программы для страницы /loyalty. */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const s = await getLoyaltySettings()
  res.json({
    enabled: s.enabled,
    tiers: sortedTiers(s.tiers).map(({ code, name, threshold, discount }) => ({ code, name, threshold, discount })),
    period_days: s.period_days,
    online_delay_days: s.online_delay_days,
    excluded_brands: s.excluded_brands,
  })
}
