import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { channelId } from "../../../../../lib/telegram/channel"
import { postLink, tgMetaOf } from "../../../../../lib/telegram/post"

/** Посты одного товара в канале — для блока «Telegram» в карточке товара. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: req.params.id } })
  const row = data[0] as { metadata: Record<string, unknown> | null } | undefined
  if (!row) { res.status(404).json({ message: "Товар не найден" }); return }
  const chat = channelId()
  res.json({
    configured: Boolean(chat && process.env.TELEGRAM_BOT_TOKEN),
    posts: tgMetaOf(row.metadata).posts.map((p) => ({ ...p, link: chat ? postLink(chat, p.id) : null })),
  })
}
