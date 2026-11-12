import Link from "next/link"

import { arrivalShort, titleWithoutBrand } from "@/lib/format"
import { isNew } from "@/lib/listing"
import { routes } from "@/lib/routes"
import type { CatalogItem } from "@/lib/types"
import { FavButton } from "./fav-button"
import { Price } from "./price"
import { QuickSizes } from "./quick-sizes"
import { YourPrice } from "./your-price"
import { FadeImage } from "./fade-image"
import { SplitBadge } from "./split-badge"

/**
 * Карточка товара в сетке (ТЗ, п. 6.2): фото 3:4 на серой подложке, второе фото при наведении,
 * бренд, название, цена, метки; размеры в наличии — при наведении (на десктопе).
 */
export function ProductCard({ item, priority = false, compact = false, sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw" }: {
  item: CatalogItem
  priority?: boolean
  /** Компактная карточка для рекомендаций: без плашек и размеров при наведении */
  compact?: boolean
  sizes?: string
}) {
  const inStock = item.sizes.filter((s) => s.in_stock)
  const alt = `${item.title} — фото`

  const lastSize = inStock.length === 1 && item.sizes.length > 1
  const showSizes = !compact && inStock.length > 0 && !(inStock.length === 1 && inStock[0].size === "One Size")

  return (
    <article className="group relative flex flex-col bg-background">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        <Link href={routes.product(item.handle)} className="absolute inset-0" tabIndex={-1} aria-hidden="true">
          {item.thumbnail && (
            <FadeImage src={item.thumbnail} alt={alt} fill priority={priority} sizes={sizes}
              className={`blend object-contain transition-opacity duration-300 ${item.hover_image ? "md:group-hover:opacity-0" : ""}`} />
          )}
          {item.hover_image && (
            <FadeImage src={item.hover_image} alt="" fill sizes={sizes} loading="lazy"
              className="blend hidden object-contain opacity-0 transition-opacity duration-300 md:block md:group-hover:opacity-100" />
          )}
        </Link>
        <div className={`pointer-events-none absolute left-3 right-14 top-3 flex flex-col items-start gap-1.5 ${compact ? "hidden" : ""}`}>
          {isNew(item) && <span className="eyebrow glass rounded-full px-2 py-1">New</span>}
          {item.preorder && <span className="eyebrow whitespace-nowrap rounded-full bg-foreground px-2 py-1 text-background">Предзаказ{arrivalShort(item.preorder_date) ? ` · ${arrivalShort(item.preorder_date)}` : ""}</span>}
          {item.outlet && <span className="eyebrow rounded-full bg-sale px-2 py-1 text-white">Outlet</span>}
          {lastSize && !item.preorder && <span className="eyebrow glass whitespace-nowrap rounded-full px-2 py-1">Последний размер</span>}
        </div>
        <FavButton handle={item.handle} title={item.title} className="glass absolute right-3 top-3 z-10 size-9 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100 [&[aria-pressed=true]]:opacity-100" />
        {/* Размеры при наведении: отдельная кнопка на каждый размер (на этапе 4 — сразу в корзину) */}
        {/* Размеры при наведении: нажатие сразу добавляет размер в корзину */}
        {showSizes && <QuickSizes sizes={inStock} />}
      </div>
      <div className={`relative flex flex-1 flex-col gap-1 px-3 pt-3 ${compact ? "pb-4" : "pb-5 md:px-4"}`}>
        {item.brand && <p className="eyebrow">{item.brand.name}</p>}
        <h3 className="line-clamp-2 text-[13px] leading-snug text-muted">
          <Link href={routes.product(item.handle)} className="after:absolute after:inset-0 after:content-['']">
            {titleWithoutBrand(item.title, item.brand?.name)}
          </Link>
        </h3>
        <div className="mt-auto pt-2">
          <Price price={item.price} compareAt={item.compare_at} />
          <YourPrice price={item.price} brand={item.brand?.name} noLoyalty={item.no_loyalty} />
          <SplitBadge amount={item.price} productId={item.sizes[0]?.variant_id} size="s" className="mt-1.5" />
        </div>
      </div>
    </article>
  )
}
