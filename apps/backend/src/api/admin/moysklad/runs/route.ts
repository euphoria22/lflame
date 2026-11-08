import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MOYSKLAD_MODULE } from "../../../../modules/moysklad"
import MoyskladModuleService from "../../../../modules/moysklad/service"

/** Журнал синхронизаций для панели в админке (ТЗ, п. 3.6). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const ms: MoyskladModuleService = req.scope.resolve(MOYSKLAD_MODULE)
  const runs = await ms.listMoyskladSyncRuns(
    {},
    {
      order: { started_at: "DESC" },
      take: 30,
      select: ["id", "kind", "mode", "trigger", "status", "started_at", "finished_at", "stats", "error"],
    }
  )
  res.json({
    runs,
    schedule_enabled: ms.options.scheduleEnabled,
    store_name: ms.options.storeName,
  })
}
