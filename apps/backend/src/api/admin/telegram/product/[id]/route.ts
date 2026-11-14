import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { netConfigured, NETS, postUrl } from "../../../../../lib/telegram/channel"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { tgMetaOf } from "../../../../../lib/telegram/post"

/** Посты одного товара в Telegram и ВКонтакте — для блока «Соцсети» в карточке товара. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "images.url", "images.rank"], filters: { id: req.params.id } })
  const row = data[0] as { metadata: Record<string, unknown> | null; images?: { url: string; rank?: number }[] } | undefined
  if (!row) { res.status(404).json({ message: "Товар не найден" }); return }
  const nets = Object.fromEntries(NETS.map((net) => [net, {
    configured: netConfigured(net),
    posts: tgMetaOf(row.metadata, net).posts.map((p) => ({ id: p.id, at: p.at, link: postUrl(net, p.id) })),
  }]))
  // configured и posts верхнего уровня — Telegram (как раньше)
  const images = [...(row.images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((i) => i.url)
  const picked = Array.isArray(row.metadata?.social_photos) ? (row.metadata!.social_photos as string[]).filter((u) => images.includes(u)) : []
  res.json({ configured: nets.tg.configured, posts: nets.tg.posts, nets, images, photos: picked })
}

/**
 * Фото для постов (Telegram и ВКонтакте): выбранные вручную, по порядку, до 10. Пустой список — все фото в порядке сайта.
 * Хранится в metadata.social_photos; синхронизация с МоимСкладом его не трогает.
 */
export async function POST(req: MedusaRequest<{ photos?: string[] }>, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "images.url"], filters: { id: req.params.id } })
  const row = data[0] as { id: string; metadata: Record<string, unknown> | null; images?: { url: string }[] } | undefined
  if (!row) { res.status(404).json({ message: "Товар не найден" }); return }
  const own = new Set((row.images ?? []).map((i) => i.url))
  const photos = [...new Set(Array.isArray(req.body?.photos) ? req.body!.photos : [])].filter((u): u is string => typeof u === "string" && own.has(u))
  if (photos.length > 10) { res.status(400).json({ message: "В посте — не больше 10 фото" }); return }
  await updateProductsWorkflow(req.scope).run({ input: { products: [{ id: row.id, metadata: { ...(row.metadata ?? {}), social_photos: photos.length ? photos : null } }] } })
  res.json({ photos })
}
