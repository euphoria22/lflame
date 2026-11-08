"use client"

import Link from "next/link"
import { useState } from "react"

import { filtersToQuery, ListingFilters, ListingScope, scopeToQuery, withQuery } from "@/lib/listing"
import type { CatalogItem } from "@/lib/types"
import { ProductCard } from "./product-card"

type Props = { basePath: string; filters: ListingFilters; page: number; pages: number; scope: ListingScope; gridClass: string; cellClass: string }

/**
 * «Показать ещё товары» + номера страниц, как у Brandshop (обратная связь 08.11.2026).
 * Номера — настоящие ссылки ?page=N для поисковиков (ТЗ, п. 7.4); кнопка догружает
 * следующую страницу под текущей и обновляет адрес.
 */
export function Pagination({ basePath, filters, page, pages, scope, gridClass, cellClass }: Props) {
  const [extra, setExtra] = useState<CatalogItem[]>([])
  const [last, setLast] = useState(page)
  const [loading, setLoading] = useState(false)

  if (pages <= 1) return null
  const href = (p: number) => withQuery(basePath, filtersToQuery({ ...filters, page: p }))

  const more = async () => {
    setLoading(true)
    try {
      const next = last + 1
      const qs = filtersToQuery({ ...filters, page: next }).replace(/^\?/, "")
      const res = await fetch(`/api/listing?${scopeToQuery(scope)}&${qs}`)
      const data = (await res.json()) as { items: CatalogItem[] }
      setExtra((x) => [...x, ...data.items])
      setLast(next)
      window.history.replaceState(null, "", href(next))
    } finally {
      setLoading(false)
    }
  }

  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - last) <= 2)
  const cell = "flex size-11 items-center justify-center rounded-md text-[14px] transition-colors"

  return (
    <>
      {extra.length > 0 && (
        <ul className={gridClass}>
          {extra.map((item) => <li key={item.id} className={cellClass}><ProductCard item={item} /></li>)}
        </ul>
      )}
      <div className="px-4 pb-4 pt-10 md:px-6">
        {last < pages && (
          <button type="button" onClick={more} disabled={loading}
            className="h-12 w-full rounded-md bg-surface text-[14px] transition-colors hover:bg-surface-2 disabled:opacity-60">
            {loading ? "Загружаем…" : "Показать ещё товары"}
          </button>
        )}
        <nav aria-label="Страницы" className="mt-6 flex items-center justify-center gap-1.5">
          {last > 1 && <Link href={href(last - 1)} rel="prev" aria-label="Предыдущая страница" className={`${cell} bg-surface hover:bg-surface-2`}>‹</Link>}
          {nums.map((p, i) => (
            <span key={p} className="flex items-center gap-1.5">
              {i > 0 && p - nums[i - 1] > 1 && <span className="px-1 text-subtle">…</span>}
              {p === last
                ? <span aria-current="page" className={`${cell} bg-foreground text-background`}>{p}</span>
                : <Link href={href(p)} className={`${cell} bg-surface hover:bg-surface-2`}>{p}</Link>}
            </span>
          ))}
          {last < pages && <Link href={href(last + 1)} rel="next" aria-label="Следующая страница" className={`${cell} bg-surface hover:bg-surface-2`}>›</Link>}
        </nav>
      </div>
    </>
  )
}
