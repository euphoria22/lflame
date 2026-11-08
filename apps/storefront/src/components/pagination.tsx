import Link from "next/link"

import { filtersToQuery, ListingFilters, withQuery } from "@/lib/listing"

/** Пагинация настоящими ссылками ?page=N (ТЗ, п. 6.2, 7.4). */
export function Pagination({ basePath, filters, page, pages }: { basePath: string; filters: ListingFilters; page: number; pages: number }) {
  if (pages <= 1) return null
  const href = (p: number) => withQuery(basePath, filtersToQuery({ ...filters, page: p }))
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
  const cell = "flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[13px]"
  return (
    <nav aria-label="Страницы" className="mt-12 flex items-center justify-center gap-1">
      {page > 1 && <Link href={href(page - 1)} rel="prev" className={`${cell} hover:bg-surface`}>←</Link>}
      {nums.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - nums[i - 1] > 1 && <span className="px-1 text-subtle">…</span>}
          {p === page
            ? <span aria-current="page" className={`${cell} bg-foreground text-background`}>{p}</span>
            : <Link href={href(p)} className={`${cell} hover:bg-surface`}>{p}</Link>}
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} rel="next" className={`${cell} hover:bg-surface`}>→</Link>}
    </nav>
  )
}
