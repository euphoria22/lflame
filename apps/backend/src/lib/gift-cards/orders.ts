import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { advanceOffsetReceipt, cloudKassirConfigured, CkLine, sendCloudKassirReceipt } from "../payments/cloudkassir"
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

type FullOrder = {
  id: string; display_id: number; email: string | null; total: unknown; metadata: Record<string, unknown> | null
  items?: { product_title?: string | null; title: string; variant_title?: string | null; quantity: number; total: unknown }[]
  shipping_methods?: { name: string; total: unknown }[]
}

/**
 * Заказ целиком оплачен подарочной картой: онлайн-платежа нет, Т-Касса чек не пробьёт.
 * Пробиваем в CloudKassir чек «зачёт аванса» (повтор не создаст второй чек); без ключей — напоминание в Telegram.
 */
export async function giftOffsetReceipt(c: MedusaContainer, orderId: string, log: Logger) {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "total", "metadata", "items.product_title", "items.title", "items.variant_title", "items.quantity", "items.total", "shipping_methods.name", "shipping_methods.total"],
    filters: { id: orderId },
  })
  const o = data[0] as unknown as FullOrder | undefined
  if (!o || o.metadata?.payment_method !== "gift" || Number(o.total) > 0) return
  if (o.metadata?.cloudkassir_receipt) return
  const lines: CkLine[] = [
    ...(o.items ?? []).map((i) => ({ label: [i.product_title || i.title, i.variant_title].filter(Boolean).join(", "), price: Number(i.total) / i.quantity, quantity: i.quantity, amount: Number(i.total), kind: "commodity" as const })),
    ...(o.shipping_methods ?? []).filter((m) => Number(m.total) > 0).map((m) => ({ label: `Доставка: ${m.name}`, price: Number(m.total), quantity: 1, amount: Number(m.total), kind: "service" as const })),
  ]
  const save = (v: Record<string, unknown>) => c.resolve(Modules.ORDER).updateOrders(o.id, { metadata: { ...(o.metadata ?? {}), cloudkassir_receipt: v } }).catch(() => null)
  if (!cloudKassirConfigured()) {
    await sendTelegram(`🧾 <b>Заказ № ${o.display_id}</b> оплачен целиком подарочной картой — пробейте чек «зачёт аванса» на ${rub(lines.reduce((s, l) => s + l.amount, 0))} (CloudKassir на сайте не подключён)`, log).catch(() => null)
    return
  }
  try {
    const body = advanceOffsetReceipt(lines, { inn: process.env.CLOUDKASSIR_INN!, taxation: Number(process.env.CLOUDKASSIR_TAXATION ?? 1), email: o.email, invoiceId: String(o.display_id) })
    const r = await sendCloudKassirReceipt(body, `gift-offset-${o.id}`)
    await save({ ok: r.ok, at: new Date().toISOString(), message: r.message })
    if (r.ok) log.info(`CloudKassir: чек зачёта аванса по заказу № ${o.display_id} отправлен`)
    else await sendTelegram(`⚠️ <b>Заказ № ${o.display_id}</b>: CloudKassir не принял чек зачёта аванса (${r.message ?? "ошибка"}) — пробейте вручную`, log).catch(() => null)
  } catch (e) {
    await sendTelegram(`⚠️ <b>Заказ № ${o.display_id}</b>: чек зачёта аванса не отправлен (${(e as Error).message}) — пробейте вручную`, log).catch(() => null)
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

