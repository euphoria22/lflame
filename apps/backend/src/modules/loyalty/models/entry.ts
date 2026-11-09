import { model } from "@medusajs/framework/utils"

/**
 * Журнал операций лояльности (ТЗ, п. 6.7): основа расчёта. Сумма за период и уровень
 * вычисляются из журнала, поэтому любой расчёт можно проверить и пересчитать.
 */
const LoyaltyEntry = model.define("loyalty_entry", {
  id: model.id({ prefix: "lent" }).primaryKey(),
  /** Клиент = телефон, +7XXXXXXXXXX */
  phone: model.text().index(),
  source: model.enum(["online", "offline", "manual"]),
  /** order — заказ сайта; retaildemand / demand / salesreturn / retailsalesreturn — документы МС; manual — корректировка */
  doc_type: model.text(),
  /** Уникальный ключ документа: повторный импорт не создаёт дублей */
  doc_id: model.text().unique(),
  doc_name: model.text().nullable(),
  /** Сумма в рублях: покупка > 0, возврат < 0 */
  amount: model.number(),
  purchased_at: model.dateTime(),
  /** Когда засчитывается (онлайн — через N дней после получения) */
  credit_at: model.dateTime(),
  status: model.enum(["pending", "credited", "cancelled"]).default("pending"),
  note: model.text().nullable(),
})

export default LoyaltyEntry
