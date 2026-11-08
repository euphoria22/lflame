import Image from "next/image"
import Link from "next/link"

import { titleWithoutBrand } from "@/lib/format"
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
  const inStock = item.sizes.filter((s) => s.in_stock)
  const alt = `${item.title} — фото`

  const lastSize = inStock.length === 1 && item.sizes.length > 1
  const showSizes = inStock.length > 0 && !(inStock.length === 1 && inStock[0].size === "One Size")

  return (
    <article className="group relative flex flex-col bg-background">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        <Link href={routes.product(item.handle)} className="absolute inset-0" tabIndex={-1} aria-hidden="true">
          {item.thumbnail && (
            <Image src={item.thumbnail} alt={alt} fill priority={priority} sizes={sizes}
              className={`blend object-contain transition-opacity duration-300 ${item.hover_image ? "md:group-hover:opacity-0" : ""}`} />
          )}
          {item.hover_image && (
            <Image src={item.hover_image} alt="" fill sizes={sizes} loading="lazy"
              className="blend hidden object-contain opacity-0 transition-opacity duration-300 md:block md:group-hover:opacity-100" />
          )}
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {isNew(item) && <span className="eyebrow glass rounded-full px-2 py-1">New</span>}
          {lastSize && <span className="eyebrow glass rounded-full px-2 py-1">Последний размер</span>}
        </div>
        {/* Размеры при наведении: отдельная кнопка на каждый размер (на этапе 4 — сразу в корзину) */}
        {showSizes && (
          <ul className="glass absolute inset-x-3 bottom-3 z-10 hidden translate-y-2 flex-wrap justify-center gap-1 rounded-[22px] p-1.5 opacity-0 transition-all duration-200 md:flex md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
            {inStock.map((s) => (
              <li key={s.size}>
                <Link href={`${routes.product(item.handle)}?size=${encodeURIComponent(s.size)}`}
                  className="block min-w-10 rounded-full px-2.5 py-1.5 text-center text-[12px] transition-colors hover:bg-foreground hover:text-background">
                  {s.size}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative flex flex-1 flex-col gap-1 px-3 pb-5 pt-3 md:px-4">
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
