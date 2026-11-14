import { model } from "@medusajs/framework/utils"

/**
 * Ручные правила (manual_rules): закрепление, буст, понижение, дроп, режим «Распродажа».
 * У каждого правила есть дата окончания — каталог не зарастает забытыми закреплениями.
 */
const SortManualRule = model.define("sort_manual_rule", {
  id: model.id({ prefix: "smr" }).primaryKey(),
  kind: model.enum(["pin", "boost", "demote", "drop", "sale"]),
  /** Цель: товар (id), бренд (адрес), коллекция (FW26); у режима «Распродажа» цели нет */
  target_type: model.enum(["product", "brand", "collection", "none"]),
  target: model.text().nullable(),
  /** Множитель буста или понижения */
  value: model.float().nullable(),
  /** Закрепление: листинг (all, new, cat:kurtki, brand:calvin-klein, gender:men/cat:kurtki) и позиция 1–8 */
  listing: model.text().nullable(),
  position: model.number().nullable(),
  starts_at: model.dateTime(),
  ends_at: model.dateTime(),
  author: model.text().nullable(),
  note: model.text().nullable(),
})

export default SortManualRule
