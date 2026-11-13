import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { activate, getCard } from "../../../../lib/gift-cards/engine"
import { tbankVerify } from "../../../../lib/payments/tbank-client"

/**
 * Уведомление Т-Кассы об оплате подарочной карты (NotificationURL при создании платежа).
 * Подпись проверяется паролем терминала; Т-Касса ждёт в ответ «OK».
 */
export async function POST(req: MedusaRequest<Record<string, unknown>>, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const n = (req.body ?? {}) as Record<string, unknown>
  const password = process.env.TBANK_PASSWORD
  if (!password || !tbankVerify(n, password)) {
    logger.warn("Подарочные карты: уведомление Т-Кассы с неверной подписью отклонено")
    res.status(403).send("FORBIDDEN")
    return
  }
  try {
    const card = await getCard(req.scope, String(n.OrderId ?? ""))
    // Сумма должна совпасть с номиналом карты
    if (card && n.Status === "CONFIRMED" && Number(n.Amount) === card.amount * 100) {
      await activate(req.scope, card.id, logger, { payment_id: String(n.PaymentId ?? "") })
    }
  } catch (e) {
    logger.warn(`Подарочные карты: уведомление ${String(n.OrderId)}: ${(e as Error).message}`)
  }
  res.send("OK")
}
