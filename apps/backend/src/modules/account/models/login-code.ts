import { model } from "@medusajs/framework/utils"

/** Одноразовые коды входа в личный кабинет (ТЗ, п. 6.5). Храним только хеш кода. */
const LoginCode = model.define("login_code", {
  id: model.id({ prefix: "lcode" }).primaryKey(),
  /** email в нижнем регистре (позже — телефон для SMS) */
  target: model.text().index(),
  code_hash: model.text(),
  expires_at: model.dateTime(),
  attempts: model.number().default(0),
  used_at: model.dateTime().nullable(),
})

export default LoginCode
