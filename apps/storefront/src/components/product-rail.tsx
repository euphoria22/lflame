import type { CatalogItem } from "@/lib/types"
import { ProductCard } from "./product-card"

/** Подборка товаров: лента на телефоне, сетка из 4 на десктопе (ТЗ, п. 6.3: рекомендации). */
export function ProductRail({ title, items, href, linkLabel = "Смотреть все" }: {
  title: string
  items: CatalogItem[]
  href?: string
  linkLabel?: string
}) {
  if (!items.length) return null
  return (
    <section className="mt-20">
      <div className="mb-5 flex items-baseline justify-between px-4 md:px-8">
        <h2 className="text-[20px] tracking-tight md:text-[24px]">{title}</h2>
        {href && <a href={href} className="eyebrow underline underline-offset-4">{linkLabel}</a>}
      </div>
      <ul className="rail grid-lines grid auto-cols-[46%] grid-flow-col overflow-x-auto md:auto-cols-auto md:grid-flow-row md:grid-cols-4 md:overflow-visible">
        {items.slice(0, 8).map((item) => (
          <li key={item.id} className="md:[&:nth-child(4n)]:border-r-0">
            <ProductCard item={item} sizes="(min-width: 768px) 25vw, 46vw" />
          </li>
        ))}
      </ul>
    </section>
  )
}
