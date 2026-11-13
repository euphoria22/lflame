import { model } from "@medusajs/framework/utils"

/**
 * Операция по карте: + пополнение (выпуск, возврат), − списание (заказ на сайте, покупка в шоуруме).
 * reference — откуда: order:<id> (заказ сайта), store (шоурум), admin, issue (выпуск).
 */
const GiftCardTransaction = model.define("gift_card_transaction", {
  id: model.id({ prefix: "gctx" }).primaryKey(),
  gift_card_id: model.text().index(),
  /** ₽: положительное — пополнение, отрицательное — списание */
  amount: model.number(),
  kind: model.enum(["issue", "redeem_online", "redeem_store", "refund", "adjust"]),
  reference: model.text().nullable(),
  note: model.text().nullable(),
  /** Кто сделал (email сотрудника) или «система» */
  created_by: model.text().nullable(),
})

export default GiftCardTransaction
