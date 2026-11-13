import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { activate, getCard } from "../../../../../lib/gift-cards/engine"
import { tbankCall } from "../../../../../lib/payments/tbank-client"

/**
 * Страница «Спасибо» после оплаты: оплачена ли карта и куда ушло письмо (код здесь не показываем — он в письме).
 * Если уведомление Т-Кассы ещё не пришло — спрашиваем статус сами.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  let card = await getCard(req.scope, req.params.id)
  if (!card) { res.status(404).json({ message: "Не найдено" }); return }
  if (card.status === "pending" && card.payment_id && process.env.TBANK_TERMINAL_KEY && process.env.TBANK_PASSWORD) {
    const s = await tbankCall({ apiUrl: process.env.TBANK_API_URL || "https://securepay.tinkoff.ru/v2", terminalKey: process.env.TBANK_TERMINAL_KEY, password: process.env.TBANK_PASSWORD }, "GetState", { PaymentId: card.payment_id }).catch(() => null)
    if (s?.Status === "CONFIRMED") card = (await activate(req.scope, card.id, req.scope.resolve(ContainerRegistrationKeys.LOGGER), { payment_id: card.payment_id })) ?? card
  }
  const mask = (e: string | null) => (e ? e.replace(/^(.)[^@]*(@.*)$/, "$1•••$2") : null)
  res.json({
    status: card.status, amount: card.amount,
    to: mask(card.recipient_email ?? card.buyer_email), gift: Boolean(card.recipient_email),
    send_at: card.send_at, expires_at: card.expires_at,
  })
}
