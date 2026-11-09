import type { Metadata } from "next"
import Link from "next/link"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { PostCard } from "@/components/post-card"
import { safePosts } from "@/lib/blog"
import { routes } from "@/lib/routes"
import { pageMeta } from "@/lib/seo"

export const metadata: Metadata = pageMeta({
  title: "Блог — новости брендов, стиль, подборки",
  description: "Новости брендов, подборки и советы по стилю от команды Laflamme.",
  path: "/blog",
})
export const instant = false

/** Список статей (ТЗ, п. 6.1 «Журнал»). Рубрика — параметром ?rubric= (каноническая — /blog). */
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ rubric?: string }> }) {
  const [{ rubric }, posts] = await Promise.all([searchParams, safePosts()])
  const rubrics = [...new Map(posts.filter((p) => p.category).map((p) => [p.category!.slug, p.category!])).values()]
  const shown = rubric ? posts.filter((p) => p.category?.slug === rubric) : posts
  const [first, ...rest] = shown

  return (
    <div className="px-4 pb-24 pt-6 md:px-8">
      <Breadcrumbs items={[{ name: "Блог", href: routes.blog() }]} />
      <h1 className="mt-6 text-[28px] tracking-tight md:text-[40px]">Блог</h1>
      {rubrics.length > 1 && (
        <ul className="rail -mx-4 mt-5 flex gap-x-5 overflow-x-auto px-4 md:mx-0 md:px-0">
          {[{ slug: "", name: "Все" }, ...rubrics].map((r) => {
            const active = (rubric ?? "") === r.slug
            return (
              <li key={r.slug} className="shrink-0">
                <Link href={r.slug ? routes.blog(r.slug) : routes.blog()} aria-current={active ? "page" : undefined}
                  className={`block py-1 text-[14px] underline-offset-4 ${active ? "underline" : "text-muted hover:text-foreground"}`}>{r.name}</Link>
              </li>
            )
          })}
        </ul>
      )}

      {!first ? (
        <p className="mt-16 text-[15px] text-muted">Статей пока нет — скоро здесь появятся новости брендов и подборки.</p>
      ) : (
        <>
          <div className="mt-8"><PostCard post={first} large priority /></div>
          {rest.length > 0 && (
            <ul className="mt-14 grid gap-x-4 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => <li key={p.id}><PostCard post={p} /></li>)}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
