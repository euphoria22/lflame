import Link from "next/link"

import { SITE_URL } from "@/lib/site"
import { JsonLd } from "./json-ld"

export type Crumb = { name: string; href: string }

/** Хлебные крошки + BreadcrumbList (ТЗ, п. 7.7, 7.12). Последний элемент — текущая страница. */
export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  const all = [{ name: "Главная", href: "/" }, ...items]
  return (
    <>
      <nav aria-label="Хлебные крошки" className={`text-[12px] text-subtle ${className}`}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {all.map((c, i) => (
            <li key={c.href} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              {i < all.length - 1 ? <Link href={c.href} className="hover:text-foreground">{c.name}</Link> : <span className="text-foreground" aria-current="page">{c.name}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE_URL}${c.href}` })),
      }} />
    </>
  )
}
