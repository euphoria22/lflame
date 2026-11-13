import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GIFT_CARD_MODULE } from "../../../../modules/gift-card"
import GiftCardModuleService from "../../../../modules/gift-card/service"
import { getCard, move, sendDue, transactions } from "../../../../lib/gift-cards/engine"
import { formatCode } from "../../../../lib/gift-cards/rules"
import { staffEmail } from "../../../../lib/admin/staff"

/** Карта: данные и журнал операций */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const card = await getCard(req.scope, req.params.id)
  if (!card) { res.status(404).json({ message: "Карта не найдена" }); return }
  res.json({ card: { ...card, code: formatCode(card.code) }, transactions: await transactions(req.scope, card.id) })
}

type Body = { action?: "redeem" | "credit" | "disable" | "enable" | "extend" | "resend"; amount?: number; note?: string; expires_at?: string; email?: string }

/**
 * Действия с картой:
 * redeem — списать (покупка в шоуруме), credit — вернуть/пополнить, disable/enable — отключить/включить,
 * extend — новый срок действия, resend — отправить письмо с картой ещё раз (можно на другой email).
 */
export async function POST(req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) {
  const svc = req.scope.resolve<GiftCardModuleService>(GIFT_CARD_MODULE)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const card = await getCard(req.scope, req.params.id)
  if (!card) { res.status(404).json({ message: "Карта не найдена" }); return }
  const b = req.body ?? {}
  const by = await staffEmail(req)
  const note = String(b.note ?? "").trim().slice(0, 300) || null
  try {
    switch (b.action) {
      case "redeem":
      case "credit": {
        const amount = Math.round(Number(b.amount))
        if (!(amount > 0)) throw new Error("Укажите сумму")
        if (b.action === "redeem") {
          if (card.status !== "active") throw new Error("Карта не действует")
          if (card.expires_at && new Date(card.expires_at).getTime() < Date.now()) throw new Error("Срок действия карты истёк")
        }
        await move(req.scope, card.id, b.action === "redeem" ? -amount : amount, { kind: b.action === "redeem" ? "redeem_store" : "refund", note: note ?? (b.action === "redeem" ? "Покупка в шоуруме" : "Возврат на карту"), by })
        break
      }
      case "disable":
      case "enable":
        if (card.status === "pending") throw new Error("Карта ещё не оплачена")
        await svc.updateGiftCards({ id: card.id, status: b.action === "disable" ? "disabled" : "active" })
        await svc.createGiftCardTransactions({ gift_card_id: card.id, amount: 0, kind: "adjust", note: [b.action === "disable" ? "Карта отключена" : "Карта включена", note].filter(Boolean).join(": "), created_by: by })
        break
      case "extend": {
        const d = new Date(String(b.expires_at ?? ""))
        if (Number.isNaN(d.getTime())) throw new Error("Укажите дату")
        await svc.updateGiftCards({ id: card.id, expires_at: d })
        await svc.createGiftCardTransactions({ gift_card_id: card.id, amount: 0, kind: "adjust", note: `Срок действия до ${d.toLocaleDateString("ru-RU")}${note ? `: ${note}` : ""}`, created_by: by })
        break
      }
      case "resend": {
        if (card.status !== "active") throw new Error("Карта не действует")
        const email = String(b.email ?? "").trim().toLowerCase()
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Неверный email")
        // Новый email — получателю (или покупателю, если карта для себя); письмо уйдёт сразу
        await svc.updateGiftCards({ id: card.id, sent_at: null, send_at: null, ...(email ? (card.recipient_email ? { recipient_email: email } : { buyer_email: email }) : {}) })
        await sendDue(req.scope, logger)
        await svc.createGiftCardTransactions({ gift_card_id: card.id, amount: 0, kind: "adjust", note: `Письмо отправлено повторно${email ? ` на ${email}` : ""}`, created_by: by })
        break
      }
      default:
        throw new Error("Неизвестное действие")
    }
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
    return
  }
  const fresh = (await getCard(req.scope, card.id))!
  res.json({ card: { ...fresh, code: formatCode(fresh.code) }, transactions: await transactions(req.scope, card.id) })
}
