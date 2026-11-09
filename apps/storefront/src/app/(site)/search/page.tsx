import type { Metadata } from "next"

import { CatalogListing, SearchParams } from "@/components/catalog-listing"
import { routes } from "@/lib/routes"
import { NOINDEX } from "@/lib/seo"
import { pageTitle } from "@/lib/site"

// Поиск не индексируется (ТЗ, п. 7.5, 7.8)
export const metadata: Metadata = { title: pageTitle("Поиск"), ...NOINDEX }
export const instant = false

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100) ?? ""
  return (
    <>
      <form action={routes.search()} className="mx-4 mt-6 flex gap-2 md:mx-8">
        <input name="q" defaultValue={q} autoFocus={!q} placeholder="Бренд, модель, категория" aria-label="Поиск по каталогу"
          className="h-12 flex-1 rounded-full border border-line px-5 text-[15px] outline-none focus:border-foreground" />
        <button className="h-12 rounded-full bg-foreground px-6 text-[14px] text-background">Найти</button>
      </form>
      {q ? (
        <CatalogListing
          scope={{ q }}
          basePath={`${routes.search()}?q=${encodeURIComponent(q)}`}
          crumbs={[{ name: "Поиск", href: routes.search() }]}
          h1={`Поиск: «${q}»`}
          searchParams={Promise.resolve(sp)}
        />
      ) : (
        <p className="px-4 py-16 text-center text-[14px] text-muted md:px-8">Введите название бренда, модели или категории.</p>
      )}
    </>
  )
}
