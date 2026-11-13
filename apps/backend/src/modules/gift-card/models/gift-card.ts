import { model } from "@medusajs/framework/utils"

/**
 * Подарочная карта (электронная). Баланс тратится частями на сайте и в шоуруме, срок — 1 год с оплаты.
 * pending — ждёт оплаты, active — действует, disabled — отключена вручную. Истёкшая — active с expires_at в прошлом.
 */
const GiftCard = model.define("gift_card", {
  id: model.id({ prefix: "gc" }).primaryKey(),
  /** Код без дефисов, заглавными: LFABCD2345XY */
  code: model.text().unique(),
  /** Номинал и остаток, ₽ */
  amount: model.number(),
  balance: model.number().default(0),
  status: model.enum(["pending", "active", "disabled"]).default("pending"),
  expires_at: model.dateTime().nullable(),
  /** Покупатель */
  buyer_name: model.text().nullable(),
  buyer_email: model.text().nullable(),
  buyer_phone: model.text().nullable(),
  /** Получатель (для себя — пусто) и поздравление */
  recipient_name: model.text().nullable(),
  recipient_email: model.text().nullable(),
  message: model.text().nullable(),
  /** Когда отправить письмо с картой; отправлено */
  send_at: model.dateTime().nullable(),
  sent_at: model.dateTime().nullable(),
  /** Как выпущена: site — куплена на сайте, admin — выпущена в админке */
  source: model.enum(["site", "admin"]).default("site"),
  /** Платёж Т-Кассы за покупку */
  payment_id: model.text().nullable(),
  paid_at: model.dateTime().nullable(),
  note: model.text().nullable(),
})

export default GiftCard
