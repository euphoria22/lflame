import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { channelId, publishProduct, updateQueue } from "../../../../lib/telegram/channel"

/** Выложить один товар прямо сейчас, вне расписания (ответ — ссылка на пост). Из очереди он убирается. */
export async function POST(req: MedusaRequest<{ id?: string }>, res: MedusaResponse) {
  const id = typeof req.body?.id === "string" ? req.body.id : null
  if (!id) { res.status(400).json({ message: "Не выбран товар" }); return }
  if (!channelId()) { res.status(400).json({ message: "Не задан канал: TELEGRAM_CHANNEL_ID в настройках сервера" }); return }
  try {
    const r = await publishProduct(req.scope, id)
    await updateQueue(req.scope, (q) => ({ ...q, items: q.items.filter((x) => x !== id) }))
    res.json(r)
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
