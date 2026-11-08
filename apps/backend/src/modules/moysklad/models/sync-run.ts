import { model } from "@medusajs/framework/utils"

/**
 * Журнал синхронизаций с МоимСкладом (ТЗ, п. 3.1, 3.6):
 * что запускалось, когда, с каким результатом и ошибками.
 */
const MoyskladSyncRun = model.define("moysklad_sync_run", {
  id: model.id({ prefix: "msrun" }).primaryKey(),
  kind: model.enum(["catalog", "stock"]),
  mode: model.enum(["full", "incremental", "products"]).default("incremental"),
  trigger: model.enum(["schedule", "manual", "webhook", "script"]).default("schedule"),
  status: model.enum(["running", "success", "partial", "failed"]).default("running"),
  started_at: model.dateTime(),
  finished_at: model.dateTime().nullable(),
  stats: model.json().nullable(),
  problems: model.json().nullable(),
  error: model.text().nullable(),
})

export default MoyskladSyncRun
