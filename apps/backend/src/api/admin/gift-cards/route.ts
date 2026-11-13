import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { staffEmail } from "../../../lib/admin/staff"
import { GIFT_CARD_MODULE } from "../../../modules/gift-card"
import GiftCardModuleService from "../../../modules/gift-card/service"
import { GiftCard, giftSettings, issueManual } from "../../../lib/gift-cards/engine"
import { formatCode, normalizeCode } from "../../../lib/gift-cards/rules"

/** «Подарочные карты»: список (поиск по коду, email, имени), итоги и настройки продажи */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve<GiftCardModuleService>(GIFT_CARD_MODULE)
  const cards = (await svc.listGiftCards({}, { order: { created_at: "DESC" }, take: 5000 })) as unknown as GiftCard[]
  const now = Date.now()
  const live = cards.filter((c) => c.status === "active" && (!c.expires_at || new Date(c.expires_at).getTime() > now))
  res.json({
    settings: await giftSettings(),
    online_payment: Boolean(process.env.TBANK_TERMINAL_KEY && process.env.TBANK_PASSWORD),
    totals: {
      active: live.length,
      balance: live.reduce((s, c) => s + c.balance, 0),
      sold: cards.filter((c) => c.status !== "pending").reduce((s, c) => s + c.amount, 0),
    },
    cards: cards.filter((c) => c.status !== "pending" || now - new Date(c.created_at).getTime() < 7 * 86_400_000).map((c) => ({
      id: c.id, code: formatCode(c.code), amount: c.amount, balance: c.balance, status: c.status,
      expired: Boolean(c.expires_at && new Date(c.expires_at).getTime() < now), expires_at: c.expires_at,
      buyer_name: c.buyer_name, buyer_email: c.buyer_email, recipient_name: c.recipient_name, recipient_email: c.recipient_email,
      send_at: c.send_at, sent_at: c.sent_at, source: c.source, created_at: c.created_at, paid_at: c.paid_at,
      search: [normalizeCode(c.code), c.buyer_name, c.buyer_email, c.buyer_phone, c.recipient_name, c.recipient_email].filter(Boolean).join(" ").toLowerCase(),
    })),
  })
}

type IssueBody = { amount?: number; email?: string | null; name?: string | null; message?: string | null; note?: string | null }

/** Выпустить карту вручную (продали в шоуруме, подарок клиенту). С email — письмо с картой уйдёт сразу. */
export async function POST(req: AuthenticatedMedusaRequest<IssueBody>, res: MedusaResponse) {
  const b = req.body ?? {}
  try {
    const card = await issueManual(req.scope, { amount: Number(b.amount), email: b.email, name: b.name, message: b.message, note: b.note, by: await staffEmail(req) }, req.scope.resolve(ContainerRegistrationKeys.LOGGER))
    res.json({ id: card.id, code: formatCode(card.code) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
