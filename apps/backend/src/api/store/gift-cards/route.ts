import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { giftSettings } from "../../../lib/gift-cards/engine"

/** Страница «Подарочные карты»: продаются ли, номиналы, своя сумма, срок; есть ли онлайн-оплата */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const s = await giftSettings()
  res.json({ ...s, online_payment: Boolean(process.env.TBANK_TERMINAL_KEY && process.env.TBANK_PASSWORD) })
}
