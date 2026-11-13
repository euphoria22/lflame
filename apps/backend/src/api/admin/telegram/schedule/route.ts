import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateQueue } from "../../../../lib/telegram/channel"
import { TgSchedule, validateSchedule } from "../../../../lib/telegram/schedule"

/** Расписание постов: окно (с — до), интервал, выкладывать ли рекомендации при пустой очереди, пауза. */
export async function POST(req: MedusaRequest<Partial<TgSchedule>>, res: MedusaResponse) {
  const r = validateSchedule(req.body ?? {})
  if (!r.value) { res.status(400).json({ message: r.error }); return }
  const q = await updateQueue(req.scope, (cur) => ({ ...cur, schedule: r.value! }))
  res.json({ schedule: q.schedule })
}
