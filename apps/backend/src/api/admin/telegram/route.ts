import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { queueLength, telegramOverview } from "../../../lib/telegram/channel"

/** Страница «Telegram»: какие товары и сколько раз выкладывали, что выложить следующим. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ ...(await telegramOverview(req.scope)), queue: queueLength() })
}
