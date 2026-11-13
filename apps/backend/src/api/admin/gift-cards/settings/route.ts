import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GiftCardSettings, validateGiftSettings } from "../../../../lib/gift-cards/rules"
import { saveShopSettings } from "../../../../lib/settings/shop-settings"

/** Настройки продажи карт: продаются ли на сайте, номиналы, своя сумма, срок действия */
export async function POST(req: AuthenticatedMedusaRequest<Partial<GiftCardSettings>>, res: MedusaResponse) {
  const r = validateGiftSettings(req.body ?? {})
  if (!r.value) { res.status(400).json({ message: r.error }); return }
  const s = await saveShopSettings({ gift_cards: r.value })
  res.json({ settings: s.gift_cards })
}
