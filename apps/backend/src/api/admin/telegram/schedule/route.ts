import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { asNet, updateQueue } from "../../../../lib/telegram/channel"
import { TgSchedule, validateSchedule } from "../../../../lib/telegram/schedule"

/** Расписание постов: окно (с — до), интервал, выкладывать ли рекомендации при пустой очереди, пауза. */
export async function POST(req: MedusaRequest<Partial<TgSchedule> & { net?: string }>, res: MedusaResponse) {
  const { net, ...body } = req.body ?? {}
  const r = validateSchedule(body)
  if (!r.value) { res.status(400).json({ message: r.error }); return }
  const q = await updateQueue(req.scope, (cur) => ({ ...cur, schedule: r.value! }), asNet(net))
  res.json({ schedule: q.schedule })
}
