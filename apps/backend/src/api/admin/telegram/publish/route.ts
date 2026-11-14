import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { asNet, NET_NAME, netConfigured, publishProduct, updateQueue } from "../../../../lib/telegram/channel"

/** Выложить один товар прямо сейчас, вне расписания (ответ — ссылка на пост). Из очереди этой сети он убирается. */
export async function POST(req: MedusaRequest<{ id?: string; net?: string }>, res: MedusaResponse) {
  const id = typeof req.body?.id === "string" ? req.body.id : null
  const net = asNet(req.body?.net)
  if (!id) { res.status(400).json({ message: "Не выбран товар" }); return }
  if (!netConfigured(net)) {
    res.status(400).json({ message: net === "vk" ? "ВКонтакте не настроен: VK_GROUP_ID и VK_ACCESS_TOKEN в настройках сервера" : "Не задан канал: TELEGRAM_CHANNEL_ID в настройках сервера" })
    return
  }
  try {
    const r = await publishProduct(req.scope, id, net)
    await updateQueue(req.scope, (q) => ({ ...q, items: q.items.filter((x) => x !== id) }), net)
    res.json({ ...r, net: NET_NAME[net] })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
