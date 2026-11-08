import Link from "next/link"

import { getCatalog } from "@/lib/catalog"
import { ListingFilters, ListingScope, parseFilters, runListing, scopeItems } from "@/lib/listing"
import { SITE_URL } from "@/lib/site"
import { routes } from "@/lib/routes"
import { Breadcrumbs, Crumb } from "./breadcrumbs"
import { FilterPanel } from "./filter-panel"
import { JsonLd } from "./json-ld"
import { Pagination } from "./pagination"
import { ProductCard } from "./product-card"

export type SearchParams = Record<string, string | string[] | undefined>

export type CatalogListingProps = {
  scope: ListingScope
  basePath: string
  crumbs: Crumb[]
  h1: string
  intro?: string | null
  seoText?: string | null
  /** Быстрые ссылки над сеткой: посадочные «категория + бренд» и т.п. (ТЗ, п. 7.12) */
  chips?: { label: string; href: string; active?: boolean }[]
  showBrandFilter?: boolean
  searchParams: Promise<SearchParams>
}

/**
 * Страница листинга (ТЗ, п. 6.2, 7.1–7.4).
 * Рендерится на сервере целиком за один проход: товары, ссылки и пагинация сразу есть
 * в исходном HTML, без заготовок и дублей. Данные каталога берутся из кэша.
 */
export async function CatalogListing(props: CatalogListingProps) {
  const { crumbs, h1, intro, chips } = props
  const filters = parseFilters(await props.searchParams)
  return (
    <>
      <div className="px-4 pb-6 pt-6 md:px-8">
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-6 text-[28px] font-normal leading-tight tracking-tight md:text-[40px]">{h1}</h1>
        {intro && <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">{intro}</p>}
        {!!chips?.length && (
          <ul className="rail -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            {chips.map((c) => (
              <li key={c.href} className="shrink-0">
                <Link href={c.href} aria-current={c.active ? "page" : undefined}
                  className={`block rounded-full px-4 py-2 text-[13px] transition-colors ${c.active ? "bg-foreground text-background" : "bg-surface hover:bg-surface-2"}`}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ListingBody {...props} filters={filters} />
    </>
  )
}

async function ListingBody({ scope, basePath, seoText, showBrandFilter = true, filters, h1 }: CatalogListingProps & { filters: ListingFilters }) {
  const items = await getCatalog()
  const scoped = scopeItems(items, scope)
  const result = runListing(scoped, filters)

  return (
    <>
      <div className="grid border-t border-line lg:grid-cols-[300px_1fr]">
        <div className="lg:border-r lg:border-line lg:pt-4">
          <FilterPanel mode="sidebar" basePath={basePath} filters={filters} facets={result.facets} total={result.total} showBrands={showBrandFilter} />
        </div>
        <div>
          <FilterPanel mode="toolbar" basePath={basePath} filters={filters} facets={result.facets} total={result.total} showBrands={showBrandFilter} />
          {result.items.length ? (
            <ul className="grid-lines grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {result.items.map((item, i) => (
                <li key={item.id} className="[&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(3n)]:border-r-0 xl:[&:nth-child(3n)]:border-r xl:[&:nth-child(4n)]:border-r-0">
                  <ProductCard item={item} priority={i < 4} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-t border-line px-6 py-24 text-center">
              <p className="text-[17px]">Ничего не нашлось</p>
              <p className="mt-2 text-[14px] text-muted">Попробуйте изменить фильтры или посмотрите <Link href={routes.newIn()} className="underline underline-offset-4">новинки</Link>.</p>
            </div>
          )}
          <Pagination basePath={basePath} filters={filters} page={result.page} pages={result.pages} />
        </div>
      </div>

      {/* SEO-текст только на первой странице (ТЗ, п. 7.4, 7.11) */}
      {seoText && result.page === 1 && (
        <section className="mx-auto mt-20 max-w-3xl px-4">
          <div className="prose-lf">
            {seoText.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </section>
      )}

      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: h1,
        numberOfItems: result.total,
        itemListElement: result.items.map((item, i) => ({
          "@type": "ListItem",
          position: (result.page - 1) * 48 + i + 1,
          url: `${SITE_URL}${routes.product(item.handle)}`,
          name: item.title,
        })),
      }} />
    </>
  )
}
