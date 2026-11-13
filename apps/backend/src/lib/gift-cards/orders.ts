import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendTelegram } from "../notify/telegram"
import { rub } from "../notify/templates"
import { GIFT_REFERENCE } from "./cart"
import { move } from "./engine"

type Logger = { info: (m: string) => void; warn: (m: string) => void }
type OrderRow = { id: string; display_id: number; credit_lines?: { amount: number; reference: string | null; reference_id: string | null }[] | null }

/** Строки подарочных карт в заказе */
export async function orderGiftLines(c: MedusaContainer, orderId: string) {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "display_id", "credit_lines.amount", "credit_lines.reference", "credit_lines.reference_id"], filters: { id: orderId } })
  const o = data[0] as unknown as OrderRow | undefined
  return { order: o, lines: (o?.credit_lines ?? []).filter((l) => l.reference === GIFT_REFERENCE && l.reference_id) }
}

/** Заказ создан: списать с карты. Если денег на карте не хватило (её успели потратить) — сообщение магазину. */
export async function onGiftOrderPlaced(c: MedusaContainer, orderId: string, log: Logger) {
  const { order, lines } = await orderGiftLines(c, orderId)
  for (const l of lines) {
    const want = Math.round(Number(l.amount))
    const r = await move(c, l.reference_id!, -want, { kind: "redeem_online", reference: `order:${orderId}`, note: `Заказ сайта № ${order!.display_id}`, allowPartial: true })
    if (r.applied !== 0 && -r.applied < want) {
      await sendTelegram(`⚠️ <b>Заказ № ${order!.display_id}</b>: на подарочной карте не хватило ${rub(want + r.applied)} — свяжитесь с покупателем для доплаты`, log).catch(() => null)
    }
  }
}

/** Заказ отменён: вернуть списанное на карту */
export async function onGiftOrderCanceled(c: MedusaContainer, orderId: string, log: Logger) {
  const { order, lines } = await orderGiftLines(c, orderId)
  for (const l of lines) {
    const r = await move(c, l.reference_id!, Math.round(Number(l.amount)), { kind: "refund", reference: `order:${orderId}`, note: `Отмена заказа № ${order!.display_id}` })
    if (r.applied) log.info(`Подарочная карта: ${rub(r.applied)} возвращено за отмену заказа № ${order!.display_id}`)
  }
}

