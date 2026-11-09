import { model } from "@medusajs/framework/utils"

/** Участник программы: текущий уровень и сумма (пересчитываются из журнала). */
const LoyaltyMember = model.define("loyalty_member", {
  id: model.id({ prefix: "lmem" }).primaryKey(),
  phone: model.text().unique(),
  name: model.text().nullable(),
  email: model.text().nullable(),
  ms_counterparty_id: model.text().nullable(),
  /** Засчитанная сумма за период, ₽ */
  total: model.number().default(0),
  /** Код уровня (BASE, MEMBER, …) */
  level: model.text().default("BASE"),
  /** Ручной уровень сотрудника (поверх расчёта), с причиной */
  level_override: model.text().nullable(),
  override_reason: model.text().nullable(),
  /** Предупреждение о понижении: дата и уровень, о котором предупредили */
  warned_at: model.dateTime().nullable(),
  warned_level: model.text().nullable(),
  recalculated_at: model.dateTime().nullable(),
})

export default LoyaltyMember
