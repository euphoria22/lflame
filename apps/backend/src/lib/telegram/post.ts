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
  // Версия оформления: меняем, когда меняется текст поста, — подписи выложенных постов обновятся сами
  ["v3", p.title, p.price, p.compare_at ?? "", p.preorder ? `pre:${p.preorder_date ?? ""}` : "", inStockSizes(p).join(","), p.promo ? `${p.promo.price}:${p.promo.label}` : ""].join("|")

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
 * Подпись поста: название-ссылка, цена (обе жирным; «SALE 🔥» — только при действующей акции и не на предзаказ;
 * постоянная скидка — просто зачёркнутая старая цена), размеры в наличии,
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
    was ? `<b>${rub(final)}</b> <b><s>${rub(was)}</s></b>${p.promo && !p.preorder ? " — <b>SALE</b> 🔥" : ""}` : `<b>${rub(final)}</b>`,
    p.promo ? `Дополнительная скидка −${p.promo.pct}% по акции «${esc(p.promo.label)}» уже в цене` : null,
    ...(p.preorder ? ["", `🕓 <b>Предзаказ</b> — ${arrival(p.preorder_date) ? `ориентировочная дата поступления до ${arrival(p.preorder_date)}` : "товар уже едет к нам"}`] : []),
    p.outlet ? "Outlet: вещь с небольшим дефектом, поэтому дешевле" : null,
    "",
    sizes.length ? `${p.preorder ? "Размеры для предзаказа" : "Размеры в наличии"}: ${sizes.join(", ")}` : p.preorder ? null : "Нет в наличии",
  ].filter((l): l is string => l !== null)
  const foot = `Оформить заказ: ${esc(opts.contact)}`

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
  /** Остаток товара и всей модели (все цвета), шт. */
  stock_units: number
  model_units: number
  is_new: boolean
  created_at: string
  posts: TgPost[]
}

export type Recommendation = { score: number; reasons: string[]; /** Место в списке рекомендаций (1 — выложить следующим) */ order?: number }

/** Что носят в этом месяце (средняя полоса и Сибирь): разделы каталога по сезонам */
const SEASON: Record<number, string[]> = {}
const set = (months: number[], cats: string[]) => months.forEach((m) => { SEASON[m] = cats })
set([11, 12, 1, 2], ["kurtki", "svitery-i-kardigany", "golovnye-ubory", "hudi-i-svitshoty", "obuv"])
set([3, 4], ["kurtki", "hudi-i-svitshoty", "dzhinsy", "bryuki", "obuv"])
set([5, 6, 7, 8], ["futbolki-i-longslivy", "shorty", "rubashki-i-polo", "sumki-i-ryukzaki", "aksessuary", "obuv"])
set([9, 10], ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany", "dzhinsy", "bryuki", "golovnye-ubory"])
export const inSeason = (categoryHandle: string | null, month: number) => Boolean(categoryHandle && SEASON[month]?.includes(categoryHandle))

const DAY = 86_400_000

/** Остаток в шкалу 0…1: 1 шт. — 0.19, 10 — 0.65, 40 и больше — 1 */
export const stockScale = (n: number) => Math.min(1, Math.log1p(Math.max(0, n)) / Math.log1p(40))

/** Спрос по разделам: продажи всех товаров раздела за 60 дней (и тех, что уже распроданы); 0…1 от самого продаваемого раздела */
export function categoryDemand(items: { category_handle: string | null; sales: number }[]): Map<string, { sales: number; level: number }> {
  const sum = new Map<string, number>()
  for (const i of items) if (i.category_handle) sum.set(i.category_handle, (sum.get(i.category_handle) ?? 0) + Math.max(0, i.sales))
  const max = Math.max(0, ...sum.values())
  return new Map([...sum].map(([k, v]) => [k, { sales: v, level: max ? Math.log1p(v) / Math.log1p(max) : 0 }]))
}

export type RecContext = { now: Date; recentBrands: Set<string>; demand?: Map<string, { sales: number; level: number }> }

/**
 * Оценка товара для поста: чем выше — тем полезнее выложить сейчас. Причины — человеческим языком.
 * Главное — остаток (много пришло — надо продавать) и спрос: продажи товара и всего его раздела
 * (бельё и футболки продаются круглый год). Дальше — давно не выкладывали, новинка, скидка, сезон.
 * Количество фото не влияет. Не предлагаем: нет в наличии, нет фото, выкладывали меньше 14 дней назад.
 */
export function recommend(item: RecItem & { category_handle: string | null }, ctx: RecContext): Recommendation | null {
  if (!item.in_stock && !item.preorder) return null
  if (item.images < 1) return null
  const reasons: string[] = []
  let score = 0
  const last = item.posts.length ? Math.max(...item.posts.map((p) => Date.parse(p.at))) : null
  const days = last ? (ctx.now.getTime() - last) / DAY : null
  if (days !== null && days < 14) return null

  // Остаток: товар и вся модель
  const stock = 0.6 * stockScale(item.stock_units) + 0.4 * stockScale(item.model_units)
  score += 40 * stock
  if (item.model_units > item.stock_units && item.model_units >= 10) reasons.push(`на складе ${item.stock_units} шт., всего модели ${item.model_units} шт.`)
  else if (item.stock_units >= 5) reasons.push(`на складе ${item.stock_units} шт.`)

  const age = (ctx.now.getTime() - Date.parse(item.created_at)) / DAY
  const fresh = item.is_new || age <= 21
  if (fresh) {
    score += 15
    // Новое поступление большой партией — главный кандидат
    if (item.model_units >= 10) { score += 15; reasons.push("новое поступление, большая партия") }
    else reasons.push("новинка")
  }

  // Спрос раздела — независимо от сезона
  const demand = item.category_handle ? ctx.demand?.get(item.category_handle) : undefined
  if (demand) {
    score += 30 * demand.level
    if (demand.level >= 0.6 && demand.sales >= 5) reasons.push(`раздел продаётся: ${demand.sales} шт. за 60 дн.`)
  }
  if (item.sales > 0) { score += Math.min(item.sales, 10) * 2.5; reasons.push(`продаж за 60 дней: ${item.sales}`) }

  if (days === null) { score += 20; reasons.push("ещё не выкладывали") }
  else { score += Math.min(days, 90) / 4; reasons.push(`последний пост ${Math.floor(days)} дн. назад`) }

  if (inSeason(item.category_handle, ctx.now.getMonth() + 1)) { score += 10; reasons.push("по сезону") }
  // Скидка — от старой цены до итоговой с учётом акции
  const final = item.promo?.price ?? item.price
  const base = item.compare_at && item.compare_at > item.price ? item.compare_at : item.price
  if (final < base) {
    const off = Math.round((1 - final / base) * 100)
    score += 5 + Math.min(off, 80) / 4
    reasons.push(`скидка ${off}%`)
  }
  if (item.promo) { score += 8; reasons.push(`акция «${item.promo.label}» −${item.promo.pct}%`) }
  if (item.sizes_total >= 3 && item.sizes_in_stock <= 2) { score += 5; reasons.push("остались последние размеры") }
  if (item.preorder) { score += 5; reasons.push(arrival(item.preorder_date) ? `предзаказ, ждём ${arrival(item.preorder_date)}` : "предзаказ") }
  if (!item.has_description) { score -= 3; reasons.push("нет описания") }
  if (item.brand && ctx.recentBrands.has(item.brand)) { score -= 15; reasons.push("бренд уже был в последние 3 дня") }
  return { score: Math.round(score), reasons }
}

type Mixable = { id: string; brand: string | null; category: string | null; model: string; score: number }

/**
 * Порядок постов: по баллу, но вперемешку. Подряд не идут: один бренд (не ближе 3 постов),
 * один раздел (не ближе 2), одна модель в разных цветах (не ближе 8). Учитываются и последние посты канала
 * (recent — от старых к новым). Нет подходящего — ослабляем правила по очереди: сначала раздел, потом бренд.
 */
export function mixOrder<T extends Mixable>(sorted: T[], recent: Omit<Mixable, "id" | "score">[] = []): T[] {
  const rest = [...sorted]
  const out: T[] = []
  const seq: Omit<Mixable, "id" | "score">[] = [...recent]
  const tail = (n: number) => seq.slice(-n)
  const rules: ((c: T) => boolean)[] = [
    (c) => !tail(8).some((p) => p.model === c.model) && (!c.brand || !tail(3).some((p) => p.brand === c.brand)) && (!c.category || !tail(2).some((p) => p.category === c.category)),
    (c) => !tail(8).some((p) => p.model === c.model) && (!c.brand || !tail(3).some((p) => p.brand === c.brand)),
    (c) => !tail(1).some((p) => p.model === c.model || (c.brand && p.brand === c.brand)),
  ]
  while (rest.length) {
    // Ищем среди ближайших 300 по баллу — дальше уже заметно хуже
    const look = rest.slice(0, 300)
    let k = -1
    for (const rule of rules) { k = look.findIndex(rule); if (k >= 0) break }
    const [pick] = rest.splice(Math.max(k, 0), 1)
    out.push(pick)
    seq.push(pick)
  }
  return out
}
