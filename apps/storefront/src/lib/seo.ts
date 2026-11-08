import type { Metadata } from "next"

import { INDEXING_ENABLED, SITE_NAME, SITE_URL } from "./site"

/** Обрезка по слову (ТЗ, п. 7.5: title ≤ 70, description ≤ 160). */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[,.;:—-]+$/, "")}…`
}

export type PageMetaInput = {
  title: string
  description: string
  /** Путь без параметров: canonical (ТЗ, п. 7.3) */
  path: string
  page?: number
  index?: boolean
  image?: string | null
  type?: "website" | "article"
}

/**
 * Метаданные страницы. Пагинация: canonical на саму страницу, «— страница N» в title (п. 7.4).
 * Пока INDEXING не включён (staging), всё закрыто от индексации (п. 7.8).
 */
export function pageMeta({ title, description, path, page = 1, index = true, image, type = "website" }: PageMetaInput): Metadata {
  const fullTitle = clip(page > 1 ? `${title} — страница ${page}` : title, 70)
  const canonical = `${SITE_URL}${path === "/" ? "" : path}${page > 1 ? `?page=${page}` : ""}` || SITE_URL
  const desc = clip(description, 160)
  const allowIndex = INDEXING_ENABLED && index
  return {
    title: fullTitle,
    description: desc,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: fullTitle,
      description: desc,
      url: canonical,
      siteName: SITE_NAME,
      locale: "ru_RU",
      type,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  }
}

export const NOINDEX: Metadata = { robots: { index: false, follow: false } }
