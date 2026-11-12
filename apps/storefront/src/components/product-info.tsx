import Link from "next/link"

import type { SizeChart } from "@/lib/blog"
import { arrivalDate } from "@/lib/format"
import { routes } from "@/lib/routes"
import { SITE_URL, SUPPORT } from "@/lib/site"
import type { CatalogProduct } from "@/lib/types"
import { BuyBox } from "./buy-box"
import { FavButton } from "./fav-button"
import { TelegramIcon, VkIcon } from "./icons"
import { CardIcon, TruckIcon } from "./method-icons"
import { Price } from "./price"
import { SplitBadge } from "./split-badge"
import { TrackView } from "./track"
import { YourPrice } from "./your-price"

/** Обмен и возврат: стрелка по кругу */
const ReturnIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4.5v3.8h3.8" />
  </svg>
)

/**
 * Колонка покупки на странице товара: бренд, название, цена, размеры, кнопка.
 * Без лишнего текста: цвет — в «Характеристиках», условия — тремя короткими ссылками,
 * вопрос в мессенджер — одной строкой.
 */
export function ProductInfo({ product, sizeChart }: { product: CatalogProduct; sizeChart: SizeChart | null }) {
  const ask = `${SUPPORT.telegram}?text=${encodeURIComponent(`Здравствуйте! Вопрос по товару «${product.title}»: ${SITE_URL}${routes.product(product.handle)}`)}`
  // Стеклянные плитки — как шапка и плашки на фото: на белом фоне видны по мягкой тени и кромке
  const cond = "glass flex flex-col items-start gap-1.5 rounded-2xl px-3 py-3 text-[12px] leading-tight transition-transform duration-300 hover:-translate-y-0.5"
  return (
    <>
      {product.brand && (
        <Link href={routes.brand(product.brand.handle)} className="eyebrow hover:opacity-60">{product.brand.name}</Link>
      )}
      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-[20px] font-normal leading-snug tracking-tight md:text-[26px]">{product.title}</h1>
        <FavButton handle={product.handle} title={product.title} className="size-10 shrink-0 border border-line hover:border-foreground" />
      </div>
      <div className="mt-4">
        <Price price={product.price} compareAt={product.compare_at} size="lg" />
        {/* «Ваша цена» участника Club; для товаров без скидки Club — пометка, только если у покупателя есть скидка */}
        <YourPrice price={product.price} brand={product.brand?.name} noLoyalty={product.no_loyalty} size="lg" />
        <SplitBadge amount={product.price} productId={product.variants[0]?.id} size="m" variant="detailed" className="mt-3" />
      </div>
      {product.preorder && (
        <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-[13px] leading-relaxed">
          <span className="eyebrow mr-2 rounded-full bg-foreground px-2 py-0.5 text-background">Предзаказ</span>
          Товар ещё едет к нам{arrivalDate(product.preorder_date) ? <>, ожидаем <b className="font-medium">{arrivalDate(product.preorder_date)}</b></> : null}. Оформите заказ сейчас — мы свяжемся, когда он поступит, и отправим в первую очередь.
        </p>
      )}
      {product.outlet && (
        <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-[13px] leading-relaxed">
          <span className="eyebrow mr-2 rounded-full bg-sale px-2 py-0.5 text-white">Outlet</span>
          {product.outlet_note ? <>Небольшой дефект: {product.outlet_note}.</> : "Вещь с небольшим дефектом, поэтому дешевле."} Оригинальный товар.
        </p>
      )}

      <div className="mt-7">
        <TrackView id={product.handle} name={product.title} price={product.price} brand={product.brand?.name} category={product.category?.name} />
        <BuyBox variants={product.variants} price={product.price} preorder={product.preorder} sizeChart={sizeChart} />
      </div>

      {/* Условия — три короткие ссылки на страницы «Доставка», «Оплата», «Обмен и возврат» */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Link href="/delivery" className={cond}><TruckIcon className="size-[18px]" /><span>Доставка<span className="block text-muted">по всей России</span></span></Link>
        <Link href="/payment" className={cond}><CardIcon className="size-[18px]" /><span>Оплата<span className="block text-muted">картой, СБП, частями</span></span></Link>
        <Link href="/returns" className={cond}><ReturnIcon className="size-[18px]" /><span>Возврат<span className="block text-muted">7 дней</span></span></Link>
      </div>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
        Вопрос по товару?
        <a href={ask} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-foreground hover:opacity-60"><TelegramIcon className="size-3.5" />Telegram</a>
        <a href={SUPPORT.vk} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-foreground hover:opacity-60"><VkIcon className="size-3.5" />ВКонтакте</a>
      </p>
    </>
  )
}
