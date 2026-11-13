import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { loadCatalogItems, loadCatalogProduct } from "../catalog/store-catalog"
import { telegramApi, TelegramError } from "../notify/telegram"
import { site } from "../notify/templates"
import { buildCaption, postLink, postPhotos, postState, PostProduct, RecItem, recommend, Recommendation, TgMeta, tgMetaOf } from "./post"

/**
 * Посты о товарах в Telegram-канале магазина (TELEGRAM_CHANNEL_ID: @имя_канала или -100…).
 * Бот (тот же, что шлёт уведомления) должен быть администратором канала с правом публиковать и редактировать.
 * История постов хранится в metadata.tg товара: сколько раз и когда выкладывали; подпись обновляется,
 * когда меняется цена или размеры в наличии.
 */
export const channelId = () => process.env.TELEGRAM_CHANNEL_ID?.trim() || null
const contact = () => process.env.TELEGRAM_ORDER_CONTACT?.trim() || "@laflammehelp"

type Logger = { info: (m: string) => void; warn: (m: string) => void }

async function readMeta(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata"], filters: { id } })
  return data[0] as { id: string; handle: string; metadata: Record<string, unknown> | null } | undefined
}

async function saveTg(container: MedusaContainer, id: string, tg: TgMeta) {
  const row = await readMeta(container, id)
  if (!row) return
  await updateProductsWorkflow(container).run({ input: { products: [{ id, metadata: { ...(row.metadata ?? {}), tg } }] } })
}

async function postProduct(container: MedusaContainer, handle: string): Promise<PostProduct | null> {
  const p = await loadCatalogProduct(container, handle)
  if (!p || p.discontinued) return null
  return {
    handle: p.handle, title: p.title, price: p.price, compare_at: p.compare_at, preorder: p.preorder, outlet: p.outlet,
    description: p.has_description ? p.description : null, specs: p.specs, sizes: p.sizes, images: p.images,
  }
}

/** Telegram просит подождать — ждём и повторяем один раз */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof TelegramError && e.retryAfter) {
      await new Promise((r) => setTimeout(r, (e.retryAfter! + 1) * 1000))
      return fn()
    }
    throw e
  }
}

/** Выложить товар в канал альбомом с подписью. Возвращает ссылку на пост (для публичного канала). */
export async function publishProduct(container: MedusaContainer, productId: string): Promise<{ id: number; link: string | null }> {
  const chat = channelId()
  if (!chat) throw new Error("Не задан канал: TELEGRAM_CHANNEL_ID в настройках сервера")
  const row = await readMeta(container, productId)
  if (!row) throw new Error("Товар не найден")
  const p = await postProduct(container, row.handle)
  if (!p) throw new Error("Товар не опубликован на сайте")
  if (!p.images.length) throw new Error("У товара нет фото")

  const caption = buildCaption(p, { site: site(), contact: contact() })
  const media = postPhotos(p.images, site()).map((url, i) => ({ type: "photo", media: url, ...(i === 0 ? { caption, parse_mode: "HTML" } : {}) }))
  const sent = await withRetry(() => telegramApi<{ message_id: number }[]>("sendMediaGroup", { chat_id: chat, media }))
  const id = sent[0].message_id
  const tg = tgMetaOf(row.metadata)
  await saveTg(container, productId, { posts: [...tg.posts, { id, at: new Date().toISOString() }], state: postState(p) })
  return { id, link: postLink(chat, id) }
}

/**
 * Обновить подписи опубликованных постов, если цена или размеры изменились (раз в 10 минут после сверки остатков).
 * Удалённый вручную пост забываем.
 */
export async function refreshPosts(container: MedusaContainer, log: Logger): Promise<number> {
  const chat = channelId()
  if (!chat || !process.env.TELEGRAM_BOT_TOKEN) return 0
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata"], pagination: { take: 100000 } })
  const posted = (data as { id: string; handle: string; metadata: Record<string, unknown> | null }[])
    .map((r) => ({ ...r, tg: tgMetaOf(r.metadata) }))
    .filter((r) => r.tg.posts.length)
  if (!posted.length) return 0
  // Цена и размеры всех товаров — одним запросом; полную карточку грузим, только если что-то изменилось
  const items = new Map((await loadCatalogItems(container)).map((i) => [i.handle, i]))
  let edited = 0
  for (const r of posted) {
    const item = items.get(r.handle)
    // Снят с сайта — пост не трогаем
    if (!item) continue
    const state = postState(item)
    if (state === r.tg.state) continue
    const product = await postProduct(container, r.handle)
    if (!product) continue
    const caption = buildCaption(product, { site: site(), contact: contact() })
    const alive: typeof r.tg.posts = []
    for (const post of r.tg.posts) {
      try {
        await withRetry(() => telegramApi("editMessageCaption", { chat_id: chat, message_id: post.id, caption, parse_mode: "HTML" }))
        alive.push(post)
        edited++
      } catch (e) {
        const msg = (e as Error).message
        if (/not modified/i.test(msg)) alive.push(post)
        else if (/not found|can't be edited/i.test(msg)) log.info(`Telegram: пост ${post.id} удалён из канала — больше не обновляем`)
        else { log.warn(`Telegram: не обновилась подпись поста ${post.id}: ${msg}`); alive.push(post) }
      }
      await new Promise((res) => setTimeout(res, 1500))
    }
    await saveTg(container, r.id, { posts: alive, state })
  }
  return edited
}

// ——— Обзор для страницы «Telegram» в админке ———

export type OverviewRow = RecItem & { link: string | null; recommendation: Recommendation | null }

export type Overview = {
  configured: { channel: string | null; token: boolean }
  totals: { products: number; posted: number; never: number; posts: number; last7: number; last30: number }
  rows: OverviewRow[]
}

const DAY = 86_400_000

export async function telegramOverview(container: MedusaContainer): Promise<Overview> {
  const items = await loadCatalogItems(container)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "description"], filters: { id: items.map((i) => i.id) }, pagination: { take: 100000 } })
  const metaById = new Map((data as { id: string; metadata: Record<string, unknown> | null }[]).map((r) => [r.id, tgMetaOf(r.metadata)]))

  const now = new Date()
  const chat = channelId()
  const allPosts = items.flatMap((i) => (metaById.get(i.id)?.posts ?? []).map((p) => ({ ...p, brand: i.brand?.name ?? null })))
  const recentBrands = new Set(allPosts.filter((p) => now.getTime() - Date.parse(p.at) < 3 * DAY && p.brand).map((p) => p.brand!))

  const rows: OverviewRow[] = items.map((i) => {
    const posts = metaById.get(i.id)?.posts ?? []
    const age = (now.getTime() - Date.parse(i.created_at)) / DAY
    const rec: RecItem = {
      id: i.id, handle: i.handle, title: i.title, thumbnail: i.thumbnail, brand: i.brand?.name ?? null, category: i.category?.name ?? null,
      price: i.price, compare_at: i.compare_at, in_stock: i.in_stock, preorder: i.preorder,
      sizes_in_stock: i.sizes.filter((s) => s.in_stock).length, sizes_total: i.sizes.length,
      images: i.images_count, has_description: i.has_description, sales: i.sales,
      is_new: i.new_manual || (!i.initial_import && age <= 21), created_at: i.created_at, posts,
    }
    const last = posts.at(-1)
    return {
      ...rec,
      link: last && chat ? postLink(chat, last.id) : null,
      recommendation: recommend({ ...rec, category_handle: i.category?.handle ?? null }, { now, recentBrands }),
    }
  })

  const since = (d: number) => allPosts.filter((p) => now.getTime() - Date.parse(p.at) < d * DAY).length
  const posted = rows.filter((r) => r.posts.length).length
  return {
    configured: { channel: chat, token: Boolean(process.env.TELEGRAM_BOT_TOKEN) },
    totals: { products: rows.length, posted, never: rows.length - posted, posts: allPosts.length, last7: since(7), last30: since(30) },
    rows,
  }
}

// ——— Очередь: несколько товаров подряд, не чаще одного альбома в 30 секунд (лимит Telegram для каналов) ———

const queue: string[] = []
let running = false
export const QUEUE_GAP_MS = 30_000

export function enqueuePublish(container: MedusaContainer, ids: string[], log: Logger): number {
  for (const id of ids) if (!queue.includes(id)) queue.push(id)
  if (!running) {
    running = true
    void (async () => {
      while (queue.length) {
        const id = queue.shift()!
        try {
          const r = await publishProduct(container, id)
          log.info(`Telegram: товар ${id} выложен (пост ${r.id})`)
        } catch (e) {
          log.warn(`Telegram: товар ${id} не выложен: ${(e as Error).message}`)
        }
        if (queue.length) await new Promise((res) => setTimeout(res, QUEUE_GAP_MS))
      }
      running = false
    })()
  }
  return queue.length
}

export const queueLength = () => queue.length
