import Image from "next/image"
import Link from "next/link"

import { postDate, type Post } from "@/lib/blog"
import { routes } from "@/lib/routes"

/** Карточка статьи: крупная обложка, рубрика, заголовок, дата. */
export function PostCard({ post, large = false, priority = false }: { post: Post; large?: boolean; priority?: boolean }) {
  return (
    <Link href={routes.post(post.slug)} className="group block">
      <span className={`relative block overflow-hidden rounded-[22px] bg-surface ${large ? "aspect-[4/5] md:aspect-[16/10]" : "aspect-[4/5]"}`}>
        {post.cover && (
          <Image src={post.cover.url} alt={post.cover.alt || post.title} fill priority={priority}
            sizes={large ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        )}
      </span>
      <span className="mt-3 flex items-center gap-2 text-[12px] text-muted">
        {post.category && <span className="eyebrow text-foreground">{post.category.name}</span>}
        {post.publishedAt && <span>{postDate(post.publishedAt)}</span>}
      </span>
      <span className={`mt-1.5 block leading-snug tracking-tight group-hover:underline group-hover:underline-offset-4 ${large ? "text-[22px] md:text-[30px]" : "text-[17px]"}`}>{post.title}</span>
      {large && post.excerpt && <span className="mt-2 block max-w-2xl text-[14px] leading-relaxed text-muted">{post.excerpt}</span>}
    </Link>
  )
}
