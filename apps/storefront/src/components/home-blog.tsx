import Link from "next/link"

import { safePosts } from "@/lib/blog"
import { routes } from "@/lib/routes"
import { PostCard } from "./post-card"

/** Блок «Блог» на главной: три последние статьи из CMS. Нет статей — блока нет. */
export async function HomeBlog() {
  const posts = await safePosts()
  if (!posts.length) return null
  return (
    <section className="mt-20 px-4 md:px-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-[20px] tracking-tight md:text-[24px]">Блог</h2>
        <Link href={routes.blog()} className="eyebrow underline underline-offset-4">Все статьи</Link>
      </div>
      <ul className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, 3).map((p) => <li key={p.id}><PostCard post={p} /></li>)}
      </ul>
    </section>
  )
}
