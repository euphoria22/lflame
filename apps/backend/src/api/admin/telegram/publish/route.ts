import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { channelId, enqueuePublish, publishProduct, QUEUE_GAP_MS } from "../../../../lib/telegram/channel"

type Body = { ids?: string[] }

/**
 * Выложить товары в канал. Один товар — сразу (в ответе ссылка на пост),
 * несколько — очередью раз в 30 секунд, чтобы Telegram не ограничил канал.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.filter((x): x is string => typeof x === "string"))] : []
  if (!ids.length) { res.status(400).json({ message: "Не выбраны товары" }); return }
  if (ids.length > 50) { res.status(400).json({ message: "Не больше 50 товаров за раз" }); return }
  if (!channelId()) { res.status(400).json({ message: "Не задан канал: TELEGRAM_CHANNEL_ID в настройках сервера" }); return }
  if (ids.length === 1) {
    try {
      res.json(await publishProduct(req.scope, ids[0]))
    } catch (e) {
      res.status(400).json({ message: (e as Error).message })
    }
    return
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const queued = enqueuePublish(req.scope, ids, logger)
  res.json({ queued, minutes: Math.ceil((queued * QUEUE_GAP_MS) / 60_000) })
}
