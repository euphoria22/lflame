import type { PromoPrice } from "../promotions/auto-price"

/**
 * Пост о товаре в Telegram-канале магазина: подпись к альбому и подсказки, что выложить.
 * Здесь только расчёты без обращений к Telegram и базе — их проверяют тесты.
 */

/** Опубликованный пост: номер первого сообщения альбома (к нему подпись) и время */
export type TgPost = { id: number; at: string }
/** Хранится в metadata товара: все посты и «отпечаток» цены и размеров на момент последнего обновления подписи */
export type TgMeta = { posts: TgPost[]; state?: string }

export type PostProduct = {
  handle: string
  title: string
  price: number
  compare_at: number | null
  /** Цена по действующей автоматической акции (11.11 и т. п.) */
  promo?: PromoPrice | null
  preorder: boolean
  /** Ожидаемая дата поступления предзаказа, ГГГГ-ММ-ДД */
  preorder_date?: string | null
  outlet: boolean
  description: string | null
  specs: string | null
  sizes: { size: string; in_stock: boolean }[]
  images: string[]
}

/** Подпись к фото в Telegram — не длиннее 1024 знаков (без учёта разметки) */
export const CAPTION_LIMIT = 1024
const MAX_PHOTOS = 10

export const tgMetaOf = (meta: Record<string, unknown> | null | undefined): TgMeta => {
  const t = meta?.tg as Partial<TgMeta> | undefined
  const posts = Array.isArray(t?.posts) ? t.posts.filter((p): p is TgPost => typeof p?.id === "number" && typeof p?.at === "string") : []
  return { posts, state: typeof t?.state === "string" ? t.state : undefined }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU").replace(/\s/g, " ")} ₽`
const stripHtml = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()

/** «25 ноября» из ГГГГ-ММ-ДД; прошедшая дата не показывается (товар вот-вот будет) */
export function arrival(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.getTime() < now.getTime() - 86_400_000) return null
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" })
}

/** Видимая длина подписи: Telegram считает текст без тегов */
export const visibleLength = (html: string) => stripHtml(html).length

export const inStockSizes = (p: Pick<PostProduct, "sizes">) => p.sizes.filter((s) => s.in_stock).map((s) => s.size)

/** Что видно в посте и может измениться: цена, размеры, наличие. Изменился — подпись обновляем. */
export const postState = (p: Pick<PostProduct, "title" | "price" | "compare_at" | "preorder" | "preorder_date" | "sizes" | "promo">) =>
  [p.title, p.price, p.compare_at ?? "", p.preorder ? `pre:${p.preorder_date ?? ""}` : "", inStockSizes(p).join(","), p.promo ? `${p.promo.price}:${p.promo.label}` : ""].join("|")

/** Текст о товаре для цитаты: описание и характеристики «Состав: …», как на сайте */
function about(p: PostProduct): string {
  const text: string[] = []
  const specs: string[] = []
  for (const line of (p.specs ?? "").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = /^([^:]{1,40}):\s*(.+)$/.exec(line)
    if (m) specs.push(`${m[1].trim()}: ${m[2].trim()}`)
    else if (/\d\s*%/.test(line)) specs.push(`Состав: ${line}`)
    else text.push(line)
  }
  const description = p.description ? stripHtml(p.description) : text.join("\n")
  return [description, specs.join("\n")].filter(Boolean).join("\n\n")
}

/**
 * Подпись поста: название-ссылка, цена (со старой — «SALE 🔥»), размеры в наличии,
 * описание и характеристики в сворачиваемой цитате, как заказать.
 */
export function buildCaption(p: PostProduct, opts: { site: string; contact: string }): string {
  const url = `${opts.site}/product/${p.handle}`
  const sizes = inStockSizes(p)
  // Итоговая цена — с учётом акции; зачёркнутая — старая цена (или цена каталога, если старой нет)
  const final = p.promo?.price ?? p.price
  const was = p.compare_at && p.compare_at > final ? p.compare_at : p.promo ? p.price : null
  const head = [
    `<b><a href="${esc(url)}">${esc(p.title)}</a></b>`,
    "",
    was ? `<b>${rub(final)}</b> <s>${rub(was)}</s> — SALE 🔥` : `<b>${rub(final)}</b>`,
    p.promo ? `Дополнительная скидка −${p.promo.pct}% по акции «${esc(p.promo.label)}» уже в цене` : null,
    ...(p.preorder ? ["", `🕓 <b>Предзаказ</b>${arrival(p.preorder_date) ? ` — ожидаем ${arrival(p.preorder_date)}` : " — товар уже едет к нам"}`,
      "Оформите заказ сейчас: свяжемся, когда товар поступит, и отправим в первую очередь"] : []),
    p.outlet ? "Outlet: вещь с небольшим дефектом, поэтому дешевле" : null,
    "",
    sizes.length ? `${p.preorder ? "Размеры для предзаказа" : "Размеры в наличии"}: ${sizes.join(", ")}` : p.preorder ? null : "Нет в наличии",
  ].filter((l): l is string => l !== null)
  const foot = `Оформить заказ: <a href="${esc(url)}">на сайте</a> или ${esc(opts.contact)}`

  // Цитата — сколько поместится в лимит подписи
  const fixed = visibleLength([...head, "", foot].join("\n")) + 4
  let text = about(p)
  const room = CAPTION_LIMIT - fixed
  if (text.length > room) text = room > 40 ? `${text.slice(0, room - 1).replace(/\s+\S*$/, "")}…` : ""
  const quote = text ? ["", `<blockquote expandable>${esc(text)}</blockquote>`] : []
  return [...head, ...quote, "", foot].join("\n").replace(/\n{3,}/g, "\n\n")
}

/** Фото для альбома: до 10 штук через сжатие сайта (оригиналы бывают больше лимита Telegram 5 МБ) */
export const postPhotos = (images: string[], site: string) =>
  images.slice(0, MAX_PHOTOS).map((src) => `${site}/_next/image?url=${encodeURIComponent(src)}&w=1080&q=85`)

/** Ссылка на пост: для публичного канала (@имя) — t.me/имя/номер */
export const postLink = (channel: string, id: number) =>
  channel.startsWith("@") ? `https://t.me/${channel.slice(1)}/${id}` : null

// ——— Подсказки: что выложить ———

export type RecItem = {
  id: string
  handle: string
  title: string
  thumbnail: string | null
  brand: string | null
  category: string | null
  price: number
  compare_at: number | null
  promo: PromoPrice | null
  in_stock: boolean
  preorder_date?: string | null
  preorder: boolean
  sizes_in_stock: number
  sizes_total: number
  images: number
  has_description: boolean
  sales: number
  is_new: boolean
  created_at: string
  posts: TgPost[]
}

export type Recommendation = { score: number; reasons: string[] }

/** Что носят в этом месяце (средняя полоса и Сибирь): разделы каталога по сезонам */
const SEASON: Record<number, string[]> = {}
const set = (months: number[], cats: string[]) => months.forEach((m) => { SEASON[m] = cats })
set([11, 12, 1, 2], ["kurtki", "svitery-i-kardigany", "golovnye-ubory", "hudi-i-svitshoty", "obuv"])
set([3, 4], ["kurtki", "hudi-i-svitshoty", "dzhinsy", "bryuki", "obuv"])
set([5, 6, 7, 8], ["futbolki-i-longslivy", "shorty", "rubashki-i-polo", "sumki-i-ryukzaki", "aksessuary", "obuv"])
set([9, 10], ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany", "dzhinsy", "bryuki", "golovnye-ubory"])
export const inSeason = (categoryHandle: string | null, month: number) => Boolean(categoryHandle && SEASON[month]?.includes(categoryHandle))

const DAY = 86_400_000

/**
 * Оценка товара для поста: чем выше — тем полезнее выложить сейчас. Причины — человеческим языком.
 * Не выкладывали ни разу, новинка, по сезону, скидка, хорошо продаётся, остались последние размеры — выше.
 * Выкладывали недавно, нет в наличии, мало фото — ниже или вовсе не предлагаем.
 */
export function recommend(item: RecItem & { category_handle: string | null }, ctx: { now: Date; recentBrands: Set<string> }): Recommendation | null {
  if (!item.in_stock && !item.preorder) return null
  if (item.images < 2) return null
  const reasons: string[] = []
  let score = 0
  const last = item.posts.length ? Math.max(...item.posts.map((p) => Date.parse(p.at))) : null
  const days = last ? (ctx.now.getTime() - last) / DAY : null
  if (days !== null && days < 14) return null

  if (days === null) { score += 40; reasons.push("ещё не выкладывали") }
  else { score += Math.min(days, 90) / 3; reasons.push(`последний пост ${Math.floor(days)} дн. назад`) }

  const age = (ctx.now.getTime() - Date.parse(item.created_at)) / DAY
  if (item.is_new || age <= 21) { score += 25; reasons.push("новинка") }
  if (inSeason(item.category_handle, ctx.now.getMonth() + 1)) { score += 15; reasons.push("по сезону") }
  // Скидка — от старой цены до итоговой с учётом акции
  const final = item.promo?.price ?? item.price
  const base = item.compare_at && item.compare_at > item.price ? item.compare_at : item.price
  if (final < base) {
    const off = Math.round((1 - final / base) * 100)
    score += 10 + Math.min(off, 80) / 3
    reasons.push(`скидка ${off}%`)
  }
  if (item.promo) { score += 10; reasons.push(`акция «${item.promo.label}» −${item.promo.pct}%`) }
  if (item.sales > 0) { score += Math.min(item.sales, 10) * 2; reasons.push(`продаж за 60 дней: ${item.sales}`) }
  if (item.sizes_total >= 3 && item.sizes_in_stock <= 2) { score += 8; reasons.push("остались последние размеры") }
  if (item.preorder) { score += 5; reasons.push(arrival(item.preorder_date) ? `предзаказ, ждём ${arrival(item.preorder_date)}` : "предзаказ") }
  if (item.images >= 5) score += 5
  if (!item.has_description) { score -= 5; reasons.push("нет описания") }
  if (item.brand && ctx.recentBrands.has(item.brand)) { score -= 15; reasons.push("бренд уже был в последние 3 дня") }
  return { score: Math.round(score), reasons }
}
