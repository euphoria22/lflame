import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { netConfigured, NETS, postUrl } from "../../../../../lib/telegram/channel"
import { tgMetaOf } from "../../../../../lib/telegram/post"

/** Посты одного товара в Telegram и ВКонтакте — для блока «Соцсети» в карточке товара. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: req.params.id } })
  const row = data[0] as { metadata: Record<string, unknown> | null } | undefined
  if (!row) { res.status(404).json({ message: "Товар не найден" }); return }
  const nets = Object.fromEntries(NETS.map((net) => [net, {
    configured: netConfigured(net),
    posts: tgMetaOf(row.metadata, net).posts.map((p) => ({ id: p.id, at: p.at, link: postUrl(net, p.id) })),
  }]))
  // configured и posts верхнего уровня — Telegram (как раньше)
  res.json({ configured: nets.tg.configured, posts: nets.tg.posts, nets })
}
