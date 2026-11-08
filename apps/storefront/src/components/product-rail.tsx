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
      {/* Компактный ряд: 6 карточек на десктопе (4 на планшете), лента на телефоне */}
      <ul className="rail grid-lines grid auto-cols-[42%] grid-flow-col overflow-x-auto md:auto-cols-auto md:grid-flow-row md:grid-cols-4 md:overflow-visible xl:grid-cols-6">
        {items.slice(0, 6).map((item, i) => (
          <li key={item.id} className={`md:[&:nth-child(4n)]:border-r-0 xl:[&:nth-child(4n)]:border-r xl:[&:nth-child(6n)]:border-r-0 ${i >= 4 ? "md:hidden xl:block" : ""}`}>
            <ProductCard item={item} compact sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 42vw" />
          </li>
        ))}
      </ul>
    </section>
  )
}
