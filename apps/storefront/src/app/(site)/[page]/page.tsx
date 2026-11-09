import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { InfoPage as InfoShell } from "@/components/info-page"
import { RichText } from "@/components/rich-text"
import { getInfoPage } from "@/lib/blog"
import { routes } from "@/lib/routes"
import { pageMeta } from "@/lib/seo"
import { SITE_NAME } from "@/lib/site"

type Props = { params: Promise<{ page: string }> }

export const instant = false

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null
  return getInfoPage(slug).catch(() => null)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).page)
  if (!p) return { title: "Страница не найдена" }
  return pageMeta({ title: p.seo.title || `${p.title} — ${SITE_NAME}`, description: p.seo.description || p.intro || `${p.title} в магазине ${SITE_NAME}`, path: routes.page(p.slug) })
}

/** Информационная страница из CMS: доставка, оплата, возврат, контакты, оферта и т. п. */
export default async function InfoPage({ params }: Props) {
  const p = await load((await params).page)
  if (!p) notFound()
  return (
    <InfoShell crumbs={[{ name: p.title, href: routes.page(p.slug) }]} title={p.title} intro={p.intro}>
      {p.content && <div className="max-w-3xl"><RichText root={p.content.root} className="info-text" /></div>}
    </InfoShell>
  )
}
