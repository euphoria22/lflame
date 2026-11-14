import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { removePlanned, vkPlanTick } from "../../../../lib/vk/plan"

/**
 * Отложка ВКонтакте: убрать запись (remove — номер записи; товар не предлагается 14 дней, слот займёт следующий)
 * или обновить отложку сейчас (sync: true), не дожидаясь 10 минут.
 */
export async function POST(req: MedusaRequest<{ remove?: number; sync?: boolean }>, res: MedusaResponse) {
  const log = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    if (typeof req.body?.remove === "number") await removePlanned(req.scope, req.body.remove)
    const stats = await vkPlanTick(req.scope, log)
    res.json({ ok: true, stats })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
