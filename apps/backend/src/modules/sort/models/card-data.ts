import { model } from "@medusajs/framework/utils"

/**
 * Данные карточки из МоегоСклада только для сортировки: закупочная цена и коллекция (FW26, SS26).
 * Отдельная таблица, а не metadata товара: metadata видно через публичный API магазина, закупку показывать нельзя.
 */
const SortCardCost = model.define("sort_card_data", {
  id: model.id({ prefix: "scd" }).primaryKey(),
  product_id: model.text().index(),
  /** ₽ */
  cost_price: model.float().nullable(),
  collection: model.text().nullable(),
})

export default SortCardCost
