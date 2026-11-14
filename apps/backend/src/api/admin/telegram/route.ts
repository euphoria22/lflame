import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { asNet, netConfigured, NETS, postUrl, readQueue, telegramOverview } from "../../../lib/telegram/channel"
import { nextSlots } from "../../../lib/telegram/schedule"

/** Страница «Соцсети»: какие товары и сколько раз выкладывали, что выложить, очередь и расписание. ?net=vk — ВКонтакте */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const net = asNet(req.query.net)
  const [overview, queue] = await Promise.all([telegramOverview(req.scope, net), readQueue(req.scope, net)])
  res.json({
    ...overview,
    nets: Object.fromEntries(NETS.map((n) => [n, netConfigured(n)])),
    queue: {
      ...queue,
      // ВКонтакте: отложенные записи со ссылками (открываются у администраторов сообщества)
      ...(queue.planned ? { planned: queue.planned.map(({ att: _a, state: _s, ...p }) => ({ ...p, link: postUrl(net, p.post_id) })) } : {}),
      slots: nextSlots(queue.schedule, new Date(), Math.max(queue.items.length, 1) + 1).map((d) => d.toISOString()) },
  })
}
