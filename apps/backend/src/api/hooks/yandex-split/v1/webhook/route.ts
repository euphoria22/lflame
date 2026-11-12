import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, PaymentWebhookEvents } from "@medusajs/framework/utils"
import { decodeJwtPayload } from "../../../../../lib/payments/yandex-pay-client"

/**
 * Уведомления Яндекс Пэй (Сплит). В кабинете Яндекс Пэй Callback URL — https://<домен API>/hooks/yandex-split,
 * Яндекс сам добавляет /v1/webhook. Тело — JWT; из него берём только номер заказа, а статус и сумму
 * провайдер запрашивает у Яндекс Пэй по нашему ключу. Дальше — стандартная обработка платежа Medusa
 * (как у /hooks/payment/…): заказ создаётся из корзины после успешной оплаты.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const chunks: Buffer[] = []
  for await (const c of req as unknown as AsyncIterable<Buffer | string>) chunks.push(typeof c === "string" ? Buffer.from(c) : c)
  const token = Buffer.concat(chunks).toString("utf8")
  const payload = decodeJwtPayload(token)
  const event = payload?.event
  const orderId = (payload?.order as { orderId?: string } | undefined)?.orderId
    ?? (payload?.operation as { orderId?: string } | undefined)?.orderId
  if (!orderId || (event !== "ORDER_STATUS_UPDATED" && event !== "OPERATION_STATUS_UPDATED")) {
    // Чужое или неизвестное событие — подтверждаем, чтобы Яндекс не повторял
    res.status(200).json({ status: "success" })
    return
  }
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  await eventBus.emit(
    { name: PaymentWebhookEvents.WebhookReceived, data: { provider: "yandex_split", payload: { data: { orderId, event }, rawData: token, headers: req.headers } } },
    { delay: 5000, attempts: 3 }
  )
  res.status(200).json({ status: "success" })
}
