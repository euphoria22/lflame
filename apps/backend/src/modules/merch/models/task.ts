import { model } from "@medusajs/framework/utils"

/**
 * Задание консультантам по выкладке: шаги по оборудованию (что повесить/выложить, что убрать, картинка из 3D),
 * отметки «сделано», фото-отчёт и замечания мерчендайзера. Консультант открывает его по секретной ссылке (token).
 */
const MerchTask = model.define("merch_task", {
  id: model.id({ prefix: "mtask" }).primaryKey(),
  layout_id: model.text().index(),
  name: model.text(),
  token: model.text().unique(),
  steps: model.json(),
  status: model.enum(["open", "done", "closed"]).default("open"),
  author: model.text().nullable(),
  note: model.text().nullable(),
})

export default MerchTask
