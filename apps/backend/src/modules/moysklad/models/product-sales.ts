import { model } from "@medusajs/framework/utils"

/**
 * Продажи товара за последние 60 дней — для сортировки «Популярные».
 * store_qty — продажи в МоёмСкладе (розница магазина и отгрузки), site_qty — заказы сайта.
 * Пересчитывается раз в сутки (job moysklad-sales).
 */
const MoyskladProductSales = model.define("moysklad_product_sales", {
  id: model.id({ prefix: "mssale" }).primaryKey(),
  moysklad_product_id: model.text().unique(),
  store_qty: model.number().default(0),
  site_qty: model.number().default(0),
})

export default MoyskladProductSales
