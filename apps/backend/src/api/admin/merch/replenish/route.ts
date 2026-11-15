import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendReplenish } from "../../../../lib/merch/replenish"
import { taskUrl } from "../../../../lib/merch/tasks"

/** Довешивание прямо сейчас: продажи магазина за вчера по текущей расстановке */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const { task, sent } = await sendReplenish(req.scope)
    if (!task) { res.json({ empty: true }); return }
    res.json({ url: taskUrl(task.token), sent })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
