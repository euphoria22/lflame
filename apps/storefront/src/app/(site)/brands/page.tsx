import type { Metadata } from "next"
import Link from "next/link"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { getCatalog, getTaxonomy } from "@/lib/catalog"
import { plural } from "@/lib/format"
import { scopeItems } from "@/lib/listing"
import { routes } from "@/lib/routes"
import { pageMeta } from "@/lib/seo"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = pageMeta({
  title: `Все бренды — оригинальная одежда и обувь в ${SITE_NAME}`,
  description: `Бренды в интернет-магазине ${SITE_NAME}: C.P. Company, Stone Island, Calvin Klein, Carhartt WIP и другие. Только оригинал, доставка по России.`,
  path: routes.brands(),
})

/** Все бренды по алфавиту, только с товарами в наличии (ТЗ, п. 6.1). */
export default async function BrandsPage() {
  const [items, taxonomy] = await Promise.all([getCatalog(), getTaxonomy()])
  const counts = new Map<string, number>()
  for (const i of scopeItems(items, {})) {
    if (i.brand) counts.set(i.brand.handle, (counts.get(i.brand.handle) ?? 0) + 1)
  }
  const brands = taxonomy.brands
    .filter((b) => counts.get(b.handle))
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
  const groups = new Map<string, typeof brands>()
  for (const b of brands) {
    const letter = /[a-z]/i.test(b.name[0]) ? b.name[0].toUpperCase() : "#"
    groups.set(letter, [...(groups.get(letter) ?? []), b])
  }

  return (
    <div className="px-4 pt-6 md:px-8">
      <Breadcrumbs items={[{ name: "Бренды", href: routes.brands() }]} />
      <h1 className="mt-6 text-[28px] tracking-tight md:text-[40px]">Бренды</h1>
      <nav aria-label="Алфавит" className="mt-6 flex flex-wrap gap-1">
        {[...groups.keys()].map((l) => (
          <a key={l} href={`#letter-${l}`} className="flex size-9 items-center justify-center rounded-full bg-surface text-[13px] hover:bg-surface-2">{l}</a>
        ))}
      </nav>
      <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {[...groups.entries()].map(([letter, list]) => (
          <section key={letter} id={`letter-${letter}`}>
            <h2 className="mb-3 border-b border-line pb-2 text-[13px] text-muted">{letter}</h2>
            <ul className="space-y-1.5 text-[15px]">
              {list.map((b) => (
                <li key={b.handle} className="flex items-baseline justify-between gap-3">
                  <Link href={routes.brand(b.handle)} className="hover:opacity-60">{b.name}</Link>
                  <span className="text-[12px] text-subtle">{counts.get(b.handle)} {plural(counts.get(b.handle)!, ["товар", "товара", "товаров"])}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
