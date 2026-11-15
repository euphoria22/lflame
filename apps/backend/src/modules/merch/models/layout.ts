import { model } from "@medusajs/framework/utils"

/**
 * Вариант расстановки торгового зала (раздел «Мерчендайзинг»): зал, оборудование, зоны — в data (JSON).
 * Вариантов может быть несколько («Зима 2026», «Чёрная пятница»); is_current — тот, что сейчас в магазине.
 */
const MerchLayout = model.define("merch_layout", {
  id: model.id({ prefix: "mlay" }).primaryKey(),
  name: model.text(),
  data: model.json(),
  is_current: model.boolean().default(false),
  author: model.text().nullable(),
})

export default MerchLayout
