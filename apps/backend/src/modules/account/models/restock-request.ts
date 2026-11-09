import { model } from "@medusajs/framework/utils"

/** «Сообщить о поступлении» (ТЗ, п. 6.3): подписка покупателя на закончившийся размер. */
const RestockRequest = model.define("restock_request", {
  id: model.id({ prefix: "rstk" }).primaryKey(),
  email: model.text().index(),
  variant_id: model.text().index(),
  product_handle: model.text(),
  product_title: model.text(),
  size: model.text(),
  /** Когда отправили письмо о поступлении; null — ещё ждёт */
  notified_at: model.dateTime().nullable(),
})

export default RestockRequest
