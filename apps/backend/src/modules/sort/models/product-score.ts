import { model } from "@medusajs/framework/utils"

/**
 * Балл карточки для климатической зоны (ТЗ сортировки, раздел 7: product_score):
 * шесть компонентов, сработавшие множители, итог, профиль весов и время расчёта.
 */
const SortProductScore = model.define("sort_product_score", {
  id: model.id({ prefix: "sps" }).primaryKey(),
  product_id: model.text().index(),
  zone: model.enum(["central", "cold", "south"]),
  n: model.float(),
  s: model.float(),
  i: model.float(),
  r: model.float(),
  z: model.float(),
  m: model.float(),
  /** [{ code, label, value }] */
  multipliers: model.json(),
  k: model.float(),
  score: model.float(),
  profile: model.text(),
  calculated_at: model.dateTime(),
})

export default SortProductScore
