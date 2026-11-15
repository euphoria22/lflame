import { model } from "@medusajs/framework/utils"

/**
 * Продажи магазина (розничные чеки МоегоСклада) по дням и размерам — для офлайн-балла, довешивания и отчётов
 * мерчендайзинга. Продажи сайта сюда не входят. Хранится 60 дней, пересчитывается каждую ночь.
 */
const MerchSale = model.define("merch_sale", {
  id: model.id({ prefix: "msale" }).primaryKey(),
  /** День продажи по Омску, ГГГГ-ММ-ДД */
  day: model.text().index(),
  /** Товар МоегоСклада (= external_id товара на сайте) */
  ms_product_id: model.text().index(),
  size: model.text().nullable(),
  qty: model.number(),
  /** Выручка, ₽ */
  revenue: model.number(),
})

export default MerchSale
