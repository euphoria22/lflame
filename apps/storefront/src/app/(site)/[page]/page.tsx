import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
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
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:px-8">
      <Breadcrumbs items={[{ name: p.title, href: routes.page(p.slug) }]} />
      <h1 className="mt-6 text-[28px] tracking-tight md:text-[40px]">{p.title}</h1>
      {p.intro && <p className="mt-3 text-[16px] leading-relaxed text-muted">{p.intro}</p>}
      {p.content && <div className="mt-10"><RichText root={p.content.root} /></div>}
    </div>
  )
}
