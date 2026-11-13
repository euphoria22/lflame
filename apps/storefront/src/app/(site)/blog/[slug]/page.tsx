import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { JsonLd } from "@/components/json-ld"
import { PostCard } from "@/components/post-card"
import { ProductRail } from "@/components/product-rail"
import { RichText } from "@/components/rich-text"
import { getPost, postDate, safePosts } from "@/lib/blog"
import { getCatalog } from "@/lib/catalog"
import { routes } from "@/lib/routes"
import { pageMeta } from "@/lib/seo"
import { SITE_NAME, SITE_URL } from "@/lib/site"

type Props = { params: Promise<{ slug: string }> }

export const instant = false

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null
  return getPost(slug).catch(() => null)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).slug)
  if (!post) return { title: "Статья не найдена" }
  return pageMeta({
    title: post.seo.title || `${post.title} — блог`,
    description: post.seo.description || post.excerpt || post.title,
    path: routes.post(post.slug),
    image: post.cover?.url,
    type: "article",
  })
}

/** Статьи заранее: несуществующая статья отвечает кодом 404 (а не 200 с текстом «не найдена»). Новые статьи открываются и без пересборки. */
export async function generateStaticParams() {
  const posts = await safePosts()
  return (posts.length ? posts.map((p) => p.slug) : ["_"]).map((slug) => ({ slug }))
}

/** Статья блога: обложка, текст, товары из статьи, другие статьи (ТЗ, п. 7.7 — BlogPosting). */
export default async function PostPage({ params }: Props) {
  const post = await load((await params).slug)
  if (!post) notFound()
  const [catalog, all] = await Promise.all([post.products.length ? getCatalog().catch(() => []) : [], safePosts()])
  const products = post.products.map((h) => catalog.find((i) => i.handle === h)).filter((i) => i?.in_stock) as typeof catalog
  const more = all.filter((p) => p.slug !== post.slug).slice(0, 3)

  return (
    <article className="pb-24 pt-6">
      <div className="px-4 md:px-8">
        <Breadcrumbs items={[{ name: "Блог", href: routes.blog() }, { name: post.title, href: routes.post(post.slug) }]} />
      </div>
      <header className="mx-auto mt-8 max-w-3xl px-4 text-center">
        <p className="flex justify-center gap-3 text-[12px] text-muted">
          {post.category && <span className="eyebrow text-foreground">{post.category.name}</span>}
          {post.publishedAt && <time dateTime={post.publishedAt}>{postDate(post.publishedAt)}</time>}
        </p>
        <h1 className="mt-4 text-[30px] leading-tight tracking-tight md:text-[48px]">{post.title}</h1>
        {post.excerpt && <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">{post.excerpt}</p>}
      </header>
      {post.cover && (
        <div className="relative mx-2 mt-10 aspect-[4/5] overflow-hidden rounded-[28px] bg-surface md:mx-4 md:aspect-[16/8]">
          <Image src={post.cover.url} alt={post.cover.alt || post.title} fill priority sizes="100vw" className="object-cover" />
        </div>
      )}
      {post.content && (
        <div className="mx-auto mt-12 max-w-[720px] px-4">
          <RichText root={post.content.root} />
        </div>
      )}

      {products.length > 0 && <ProductRail title="Товары из статьи" items={products} />}

      {more.length > 0 && (
        <section className="mt-20 px-4 md:px-8">
          <h2 className="mb-6 text-[20px] tracking-tight md:text-[24px]">Читайте также</h2>
          <ul className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => <li key={p.id}><PostCard post={p} /></li>)}
          </ul>
        </section>
      )}

      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt ?? undefined,
        image: post.cover?.url,
        datePublished: post.publishedAt ?? undefined,
        mainEntityOfPage: `${SITE_URL}${routes.post(post.slug)}`,
        publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      }} />
    </article>
  )
}
