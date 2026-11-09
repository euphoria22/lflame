import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { subscribeNewsletter } from "../../../lib/newsletter/newsletter"
import { getShopSettings } from "../../../lib/settings/shop-settings"

/** Показывать ли форму подписки и какую скидку обещать. */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const n = (await getShopSettings()).newsletter
  res.json({ enabled: n.enabled, discount_pct: n.discount_pct })
}

export async function POST(req: MedusaRequest<{ email?: string; source?: string }>, res: MedusaResponse) {
  try {
    const source = ["footer", "checkout"].includes(String(req.body?.source)) ? String(req.body?.source) : "footer"
    res.json(await subscribeNewsletter(req.scope, String(req.body?.email ?? ""), source))
  } catch (e) {
    res.status(e instanceof MedusaError ? 400 : 500).json({ message: e instanceof MedusaError ? e.message : "Не получилось подписаться" })
  }
}
