import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asNet, updateQueue } from "../../../../lib/telegram/channel"
import { vkPlanTick } from "../../../../lib/vk/plan"
import { TgSchedule, validateSchedule } from "../../../../lib/telegram/schedule"

/** Расписание постов: окно (с — до), интервал, выкладывать ли рекомендации при пустой очереди, пауза. */
export async function POST(req: MedusaRequest<Partial<TgSchedule> & { net?: string; horizon_days?: number }>, res: MedusaResponse) {
  const { net, horizon_days, ...body } = req.body ?? {}
  const horizon = Number(horizon_days)
  const r = validateSchedule(body)
  if (!r.value) { res.status(400).json({ message: r.error }); return }
  const q = await updateQueue(req.scope, (cur) => ({
    ...cur, schedule: r.value!,
    // ВКонтакте: на сколько дней вперёд заполнять отложку
    ...(asNet(net) === "vk" && Number.isInteger(horizon) && horizon >= 1 && horizon <= 14 ? { horizon_days: horizon } : {}),
  }), asNet(net))
  if (asNet(net) === "vk") void vkPlanTick(req.scope, req.scope.resolve(ContainerRegistrationKeys.LOGGER)).catch(() => null)
  res.json({ schedule: q.schedule })
}
