import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readQueue, telegramOverview } from "../../../lib/telegram/channel"
import { nextSlots } from "../../../lib/telegram/schedule"

/** Страница «Telegram»: какие товары и сколько раз выкладывали, что выложить, очередь и расписание. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [overview, queue] = await Promise.all([telegramOverview(req.scope), readQueue(req.scope)])
  res.json({ ...overview, queue: { ...queue, slots: nextSlots(queue.schedule, new Date(), Math.max(queue.items.length, 1) + 1).map((d) => d.toISOString()) } })
}
