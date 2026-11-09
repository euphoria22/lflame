import "server-only"
import { cacheLife, cacheTag } from "next/cache"

/**
 * Блог: статьи из CMS Payload (ТЗ, п. 1.3, 6.1). Кэш сбрасывается тегом "blog" при публикации в CMS.
 * Ошибки CMS не кэшируются; страницы при недоступной CMS показывают пустой список.
 */
export const CMS_URL = (process.env.CMS_URL || "http://localhost:3001").replace(/\/+$/, "")

export type Media = { url: string; alt: string; width?: number; height?: number }
export type BlogCategory = { id: number | string; name: string; slug: string }
export type LexicalNode = {
  type: string
  tag?: string
  text?: string
  format?: number | string
  listType?: string
  url?: string
  fields?: { url?: string; newTab?: boolean; linkType?: string; doc?: unknown }
  value?: { url?: string; alt?: string; width?: number; height?: number; sizes?: Record<string, { url?: string }> }
  children?: LexicalNode[]
}
export type Post = {
  id: number | string
  title: string
  slug: string
  excerpt: string | null
  publishedAt: string | null
  category: BlogCategory | null
  cover: Media | null
  content: { root: LexicalNode } | null
  products: string[]
  seo: { title: string | null; description: string | null }
}

type RawMedia = { url?: string; alt?: string; width?: number; height?: number; sizes?: Record<string, { url?: string | null; width?: number; height?: number }> }
type RawPost = Omit<Post, "cover" | "category" | "products" | "seo"> & {
  cover?: RawMedia | null
  category?: BlogCategory | null
  products?: string | null
  seo?: { title?: string | null; description?: string | null } | null
}

export const absMedia = (url: string | undefined | null) => (!url ? null : url.startsWith("http") ? url : `${CMS_URL}${url}`)

function media(m: RawMedia | null | undefined, size: "card" | "large"): Media | null {
  const url = absMedia(m?.sizes?.[size]?.url || m?.url)
  return url ? { url, alt: m?.alt ?? "", width: m?.sizes?.[size]?.width ?? m?.width, height: m?.sizes?.[size]?.height ?? m?.height } : null
}

/** Адреса товаров: ссылки вида https://…/product/handle или просто handle. */
function handles(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\s+/)
    .map((s) => s.trim().replace(/\/+$/, "").split("/product/").pop() ?? "")
    .map((s) => s.split(/[?#]/)[0])
    .filter((s) => /^[a-z0-9-]+$/.test(s))
    .slice(0, 12)
}

function toPost(p: RawPost, size: "card" | "large"): Post {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? null,
    publishedAt: p.publishedAt ?? null,
    category: p.category && typeof p.category === "object" ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
    cover: media(p.cover, size),
    content: p.content ?? null,
    products: handles(p.products),
    seo: { title: p.seo?.title ?? null, description: p.seo?.description ?? null },
  }
}

async function cms<T>(path: string): Promise<T> {
  const res = await fetch(`${CMS_URL}/api${path}`, { headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`CMS ${res.status} ${path}`)
  return res.json() as Promise<T>
}

const PUBLISHED = "where[_status][equals]=published"

export async function getPosts(): Promise<Post[]> {
  "use cache"
  cacheTag("blog")
  cacheLife({ stale: 60, revalidate: 600, expire: 86400 })
  const { docs } = await cms<{ docs: RawPost[] }>(`/posts?${PUBLISHED}&sort=-publishedAt&limit=200&depth=1&select[content]=false`)
  return docs.map((d) => toPost(d, "card"))
}

export async function getPost(slug: string): Promise<Post | null> {
  "use cache"
  cacheTag("blog", `blog:${slug}`)
  cacheLife({ stale: 60, revalidate: 600, expire: 86400 })
  const { docs } = await cms<{ docs: RawPost[] }>(`/posts?${PUBLISHED}&where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=2`)
  return docs[0] ? toPost(docs[0], "large") : null
}

/** Без падения страницы, если CMS недоступна. */
export async function safePosts(): Promise<Post[]> {
  try {
    return await getPosts()
  } catch {
    return []
  }
}

export const postDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "")

/* ---------- Информационные страницы ---------- */

export type InfoPage = { title: string; slug: string; intro: string | null; content: { root: LexicalNode } | null; seo: { title: string | null; description: string | null } }

/** Страница из CMS (доставка, оплата, оферта…). Кэш сбрасывается тегом "pages" при сохранении в CMS. */
export async function getInfoPage(slug: string): Promise<InfoPage | null> {
  "use cache"
  cacheTag("pages", `page:${slug}`)
  cacheLife({ stale: 60, revalidate: 600, expire: 86400 })
  const { docs } = await cms<{ docs: (InfoPage & { seo?: InfoPage["seo"] | null })[] }>(`/pages?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=1`)
  const d = docs[0]
  return d ? { title: d.title, slug: d.slug, intro: d.intro ?? null, content: d.content ?? null, seo: { title: d.seo?.title ?? null, description: d.seo?.description ?? null } } : null
}

/** Адреса всех страниц — для карты сайта. */
export async function listInfoPages(): Promise<string[]> {
  "use cache"
  cacheTag("pages")
  cacheLife({ stale: 60, revalidate: 600, expire: 86400 })
  const { docs } = await cms<{ docs: { slug: string }[] }>(`/pages?limit=100&depth=0&select[slug]=true`)
  return docs.map((d) => d.slug)
}

/* ---------- Плашка с акциями над шапкой ---------- */

export type Announcement = { theme: "dark" | "sale" | "light"; items: { text: string; link: string | null; linkLabel: string | null }[] }

export async function getAnnouncement(): Promise<Announcement | null> {
  "use cache"
  cacheTag("announcement")
  cacheLife({ stale: 60, revalidate: 600, expire: 86400 })
  const g = await cms<{ enabled?: boolean; theme?: Announcement["theme"]; items?: { text: string; link?: string | null; linkLabel?: string | null }[] }>("/globals/announcement?depth=0")
  const items = (g.items ?? []).filter((i) => i.text?.trim()).map((i) => ({ text: i.text.trim(), link: i.link?.trim() || null, linkLabel: i.linkLabel?.trim() || null }))
  return g.enabled && items.length ? { theme: g.theme ?? "dark", items } : null
}

export async function safeAnnouncement(): Promise<Announcement | null> {
  try {
    return await getAnnouncement()
  } catch {
    return null
  }
}

/* ---------- Главная: баннер-кампания ---------- */

export type HomeHero = {
  /** Видео (mp4/webm) или GIF поверх фото */
  video: { url: string; type: string } | null
  image: Media
  imageMobile: Media | null
  eyebrow: string | null
  title: string | null
  textColor: "light" | "dark"
  focus: "top" | "center" | "bottom"
  buttons: { label: string; link: string }[]
}

type RawHero = {
  enabled?: boolean; image?: RawMedia | null; video?: (RawMedia & { mimeType?: string }) | null; imageMobile?: RawMedia | null; eyebrow?: string | null; title?: string | null
  textColor?: "light" | "dark" | null; focus?: "top" | "center" | "bottom" | null; buttons?: { label: string; link: string }[] | null
}

/** Баннер первого экрана из CMS. null — выключен или нет фото (тогда на главной карточки разделов). */
export async function getHomeHero(): Promise<HomeHero | null> {
  "use cache"
  cacheTag("home")
  cacheLife({ stale: 60, revalidate: 600, expire: 86400 })
  const g = await cms<{ hero?: RawHero }>("/globals/home?depth=1")
  const h = g.hero
  const image = media(h?.image, "large")
  const videoUrl = absMedia(h?.video?.url)
  if (!h?.enabled || !image) return null
  return {
    video: videoUrl ? { url: videoUrl, type: h?.video?.mimeType ?? "video/mp4" } : null,
    image,
    imageMobile: media(h.imageMobile, "card"),
    eyebrow: h.eyebrow?.trim() || null,
    title: h.title?.trim() || null,
    textColor: h.textColor === "dark" ? "dark" : "light",
    focus: h.focus === "top" || h.focus === "bottom" ? h.focus : "center",
    buttons: (h.buttons ?? []).filter((b) => b.label && b.link).slice(0, 3),
  }
}

export async function safeHomeHero(): Promise<HomeHero | null> {
  try {
    return await getHomeHero()
  } catch {
    return null
  }
}
