import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendChecklist } from "../../../../../../lib/merch/checklists"
import { loadMerchSettings } from "../../../../../../lib/merch/settings"
import { taskUrl } from "../../../../../../lib/merch/tasks"

/** Отправить чек-лист прямо сейчас (не дожидаясь расписания) */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const cl = (await loadMerchSettings()).checklists.find((x) => x.id === req.params.id)
    if (!cl) throw new Error("Чек-лист не найден — сначала сохраните правила")
    const { task, sent } = await sendChecklist(req.scope, cl)
    res.json({ url: taskUrl(task.token), sent })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
