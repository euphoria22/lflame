import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HELP_TABS, InfoCard, InfoPage as InfoShell } from "@/components/info-page"
import { ChevronIcon } from "@/components/icons"
import { JsonLd } from "@/components/json-ld"
import { RichNodes, RichText } from "@/components/rich-text"
import { getInfoPage, listInfoPages, type LexicalNode } from "@/lib/blog"
import { routes } from "@/lib/routes"
import { pageMeta } from "@/lib/seo"
import { SITE_NAME } from "@/lib/site"

type Props = { params: Promise<{ page: string }> }

export const instant = false

/**
 * Список страниц из CMS заранее: тогда на несуществующий адрес (laflamme.ru/что-угодно) Next.js
 * отвечает настоящим кодом 404, а не 200 с текстом «не найдена». Новые страницы CMS открываются и без пересборки.
 */
export async function generateStaticParams() {
  const slugs = await listInfoPages().catch(() => [] as string[])
  // Next.js требует хотя бы один адрес — заглушка отдаёт 404
  return (slugs.length ? slugs : ["_"]).map((page) => ({ page }))
}

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null
  return getInfoPage(slug).catch(() => null)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).page)
  if (!p) return { title: "Страница не найдена" }
  return pageMeta({ title: p.seo.title || p.title, description: p.seo.description || p.intro || `${p.title} в магазине ${SITE_NAME}`, path: routes.page(p.slug) })
}

type Section = { title: string; nodes: LexicalNode[] }

const plain = (n: LexicalNode): string => (n.text ?? "") + (n.children ?? []).map(plain).join("")

/** Текст до первого заголовка H2 — вводная часть; каждый H2 со своим текстом — отдельная карточка. */
function split(nodes: LexicalNode[]): { lead: LexicalNode[]; sections: Section[] } {
  const lead: LexicalNode[] = []
  const sections: Section[] = []
  for (const n of nodes) {
    if (n.type === "heading" && (n.tag === "h2" || n.tag === "h1")) sections.push({ title: plain(n), nodes: [] })
    else (sections.at(-1)?.nodes ?? lead).push(n)
  }
  return { lead, sections }
}

/** Способы оплаты — карточка на странице «Оплата» (как на прежнем сайте). */
function PaymentMethods() {
  const items = [
    ["Банковская карта", "Visa, Mastercard, МИР"],
    ["СБП", "по QR-коду или в приложении банка"],
    ["T-Pay", "в приложении Т-Банка"],
    ["Яндекс Сплит", "оплата частями"],
  ]
  return (
    <InfoCard title="Способы оплаты">
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(([name, hint]) => (
          <li key={name} className="rounded-2xl bg-background px-5 py-4">
            <p className="text-[15px]">{name}</p>
            <p className="mt-1 text-[13px] text-muted">{hint}</p>
          </li>
        ))}
      </ul>
    </InfoCard>
  )
}

/**
 * Информационная страница из CMS: доставка, оплата, возврат, контакты, оферта и т. п.
 * Страницы раздела «Покупателям» — с вкладками и карточками; оферта и политика — сплошным текстом.
 */
export default async function InfoPage({ params }: Props) {
  const p = await load((await params).page)
  if (!p) notFound()
  const path = routes.page(p.slug)
  const help = HELP_TABS.some((t) => t.href === path)
  const { lead, sections } = split(p.content?.root.children ?? [])
  // 2 или 4 раздела — две колонки; больше — плотная раскладка в три колонки без дыр между карточками разной высоты
  const masonry = sections.length > 2 && sections.length !== 4

  return (
    <InfoShell crumbs={[{ name: p.title, href: path }]} title={p.title} intro={p.intro} tab={help ? path : undefined}>
      {!help ? (
        p.content && <div className="max-w-3xl"><RichText root={p.content.root} className="info-text" /></div>
      ) : (
        <div className="space-y-10">
          {p.slug === "payment" ? (
            <div className="grid items-start gap-6 lg:grid-cols-2">
              {!!lead.length && <InfoCard><RichNodes nodes={lead} /></InfoCard>}
              <PaymentMethods />
            </div>
          ) : (
            !!lead.length && <RichNodes nodes={lead} className="info-text max-w-3xl" />
          )}
          {p.slug === "faq" ? (
            // Вопросы — раскрывающимся списком, + разметка FAQPage для поисковиков
            <div className="max-w-3xl divide-y divide-line border-y border-line">
              {sections.map((sec, i) => (
                <details key={i} className="group/q">
                  <summary className="flex items-center justify-between gap-6 py-5 text-[17px] tracking-tight">
                    {sec.title}
                    <ChevronIcon className="size-5 shrink-0 text-muted transition-transform duration-300 group-open/q:rotate-180" />
                  </summary>
                  <div className="pb-6 pr-10"><RichNodes nodes={sec.nodes} /></div>
                </details>
              ))}
              <JsonLd data={{
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: sections.map((sec) => ({ "@type": "Question", name: sec.title, acceptedAnswer: { "@type": "Answer", text: sec.nodes.map(plain).join(" ").replace(/\s+/g, " ").trim() } })),
              }} />
            </div>
          ) : !!sections.length && (
            <div className={masonry ? "gap-4 md:columns-2 xl:columns-3" : "grid items-start gap-4 md:grid-cols-2"}>
              {sections.map((sec, i) => (
                <InfoCard key={i} title={sec.title} className={masonry ? "mb-4 break-inside-avoid" : ""}><RichNodes nodes={sec.nodes} /></InfoCard>
              ))}
            </div>
          )}
        </div>
      )}
    </InfoShell>
  )
}
