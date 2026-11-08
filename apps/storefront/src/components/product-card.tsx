import Image from "next/image"
import Link from "next/link"

import { discountPercent, titleWithoutBrand } from "@/lib/format"
import { isNew } from "@/lib/listing"
import { routes } from "@/lib/routes"
import type { CatalogItem } from "@/lib/types"
import { Price } from "./price"

/**
 * Карточка товара в сетке (ТЗ, п. 6.2): фото 3:4 на серой подложке, второе фото при наведении,
 * бренд, название, цена, метки; размеры в наличии — при наведении (на десктопе).
 */
export function ProductCard({ item, priority = false, sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw" }: {
  item: CatalogItem
  priority?: boolean
  sizes?: string
}) {
  const off = discountPercent(item.price, item.compare_at)
  const inStock = item.sizes.filter((s) => s.in_stock)
  const alt = `${item.title} — фото`

  return (
    <article className="group relative flex flex-col bg-background">
      <Link href={routes.product(item.handle)} className="relative block aspect-[3/4] overflow-hidden bg-surface">
        {item.thumbnail && (
          <Image src={item.thumbnail} alt={alt} fill priority={priority} sizes={sizes}
            className={`blend object-contain transition-opacity duration-300 ${item.hover_image ? "md:group-hover:opacity-0" : ""}`} />
        )}
        {item.hover_image && (
          <Image src={item.hover_image} alt="" fill sizes={sizes} loading="lazy"
            className="blend hidden object-contain opacity-0 transition-opacity duration-300 md:block md:group-hover:opacity-100" />
        )}
        {isNew(item) && !off && <span className="eyebrow absolute left-3 top-3">New</span>}
        {inStock.length > 0 && !(inStock.length === 1 && inStock[0].size === "One Size") && (
          <div className="glass absolute inset-x-3 bottom-3 hidden translate-y-2 rounded-full px-4 py-2 text-center text-[12px] opacity-0 transition-all duration-200 md:block md:group-hover:translate-y-0 md:group-hover:opacity-100">
            {inStock.map((s) => s.size).join(" · ")}
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-3 pb-5 pt-3 md:px-4">
        {item.brand && <p className="eyebrow">{item.brand.name}</p>}
        <h3 className="line-clamp-2 text-[13px] leading-snug text-muted">
          <Link href={routes.product(item.handle)} className="after:absolute after:inset-0 after:content-['']">
            {titleWithoutBrand(item.title, item.brand?.name)}
          </Link>
        </h3>
        <div className="mt-auto pt-2"><Price price={item.price} compareAt={item.compare_at} /></div>
      </div>
    </article>
  )
}
