import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { BuyBox } from "@/components/buy-box"
import { FavButton } from "@/components/fav-button"
import { JsonLd } from "@/components/json-ld"
import { Price } from "@/components/price"
import { TrackView } from "@/components/track"
import { YourPrice } from "@/components/your-price"
import { ProductGallery } from "@/components/product-gallery"
import { ProductRail } from "@/components/product-rail"
import { RecentlyViewed } from "@/components/recently-viewed"
import { ChevronIcon } from "@/components/icons"
import { sizeChartFor } from "@/lib/blog"
import { getCatalog, getProduct } from "@/lib/catalog"
import { arrivalDate, formatPrice } from "@/lib/format"
import { scopeItems } from "@/lib/listing"
import { GenderSlug, genderInfo, routes } from "@/lib/routes"
import { clip, pageMeta } from "@/lib/seo"
import { SITE_NAME, SITE_URL, TITLE_SUFFIX } from "@/lib/site"
import type { CatalogItem, CatalogProduct } from "@/lib/types"

type Props = { params: Promise<{ handle: string }> }

// Полный HTML сразу: карточка товара — главная SEO-страница (ТЗ, п. 7.1)
export const instant = false

export async function generateStaticParams() {
  const items = await getCatalog()
  return items.map((i) => ({ handle: i.handle }))
}

/** Раздел для крошек и ссылок: унисекс показываем в мужском (ассортимент в основном мужской). */
const genderOf = (p: CatalogItem): GenderSlug => (p.gender === "women" ? "women" : "men")

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).handle)
  if (!product || product.discontinued) return {}
  const color = product.color_name ? ` ${product.color_name.toLowerCase()}` : ""
  return pageMeta({
    // ТЗ, п. 7.5: «{Бренд} {Название} — купить за {цена} ₽ | Laflamme» (суффикс добавляет pageMeta)
    // Длинное название — без «купить за …», чтобы цена не обрезалась посередине
    title: `${product.title} — купить за ${formatPrice(product.price)}`.length <= 70 - TITLE_SUFFIX.length ? `${product.title} — купить за ${formatPrice(product.price)}` : product.title,
    description: `${product.title}${color} — оригинал по цене ${formatPrice(product.price)}${product.compare_at ? ` вместо ${formatPrice(product.compare_at)}` : ""}. Доставка по России, оплата частями, обмен и возврат в ${SITE_NAME}.`,
    path: routes.product(product.handle),
    image: product.images[0] ?? product.thumbnail,
    index: product.status === "published",
  })
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params
  const product = await getProduct(handle)
  if (!product) notFound()

  const g = genderOf(product)
  // Снят с продажи навсегда: 301 на «категория + бренд», иначе на категорию (ТЗ, п. 7.6)
  if (product.discontinued) {
    if (product.category && product.brand) permanentRedirect(routes.categoryBrand(g, product.category.handle, product.brand.handle))
    if (product.category) permanentRedirect(routes.category(g, product.category.handle))
    permanentRedirect(routes.gender(g))
  }
  // Таблица размеров под этот товар: мужская / женская, одежда / джинсы / обувь…
  const sizeChart = await sizeChartFor({ gender: product.gender, category: product.category?.handle ?? null, brand: product.brand?.name ?? null })

  const items = await getCatalog()
  const pool = scopeItems(items, {}).filter((i) => i.handle !== product.handle)
  const sameBrand = product.brand ? pool.filter((i) => i.brand?.handle === product.brand!.handle) : []
  const similar = pool
    .filter((i) => i.category?.handle === product.category?.handle && (i.gender === product.gender || i.gender === "unisex"))
    .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price))
  const inStock = product.variants.some((v) => v.available > 0)
  const gInfo = genderInfo(g)!

  const crumbs = [
    { name: gInfo.name, href: routes.gender(g) },
    ...(product.category ? [{ name: product.category.name, href: routes.category(g, product.category.handle) }] : []),
    ...(product.category && product.brand ? [{ name: product.brand.name, href: routes.categoryBrand(g, product.category.handle, product.brand.handle) }] : []),
    { name: product.title, href: routes.product(product.handle) },
  ]

  return (
    <>
      <div className="px-4 pb-4 pt-2 md:px-8 md:pt-4">
        <Breadcrumbs items={crumbs} />
      </div>

      <div className="grid border-t border-line md:grid-cols-[minmax(340px,420px)_1fr] lg:grid-cols-[440px_1fr]">
        {/* Галерея: на телефоне сверху, на десктопе справа */}
        <div className="md:order-2 md:border-l md:border-line">
          <ProductGallery images={product.images} title={product.title} />
        </div>

        {/* Информация: на десктопе закреплена при прокрутке */}
        <div className="md:order-1">
          <div className="px-4 py-6 md:sticky md:top-[84px] md:px-8 md:py-10">
            {product.brand && (
              <Link href={routes.brand(product.brand.handle)} className="eyebrow hover:opacity-60">{product.brand.name}</Link>
            )}
            <div className="mt-2 flex items-start justify-between gap-4">
              <h1 className="text-[22px] font-normal leading-snug tracking-tight md:text-[26px]">{product.title}</h1>
              <FavButton handle={product.handle} title={product.title} className="size-10 shrink-0 border border-line hover:border-foreground" />
            </div>
            <div className="mt-4">
              <Price price={product.price} compareAt={product.compare_at} size="lg" />
              <YourPrice price={product.price} brand={product.brand?.name} noLoyalty={product.no_loyalty} size="lg" />
            </div>
            {product.color_name && <p className="mt-2 text-[13px] text-muted">Цвет: {product.color_name}</p>}
            {product.preorder && (
              <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-[13px] leading-relaxed">
                <span className="eyebrow mr-2 rounded-full bg-foreground px-2 py-0.5 text-background">Предзаказ</span>
                Товар ещё едет к нам{arrivalDate(product.preorder_date) ? <>, ожидаем <b className="font-medium">{arrivalDate(product.preorder_date)}</b></> : null}. Оформите заказ сейчас — мы свяжемся, когда он поступит, и отправим в первую очередь.
              </p>
            )}
            {product.no_loyalty && <p className="mt-2 text-[12px] text-muted">Скидка Laflamme Club на этот товар не действует</p>}

            <div className="mt-8">
              <TrackView id={product.handle} name={product.title} price={product.price} brand={product.brand?.name} category={product.category?.name} />
              <BuyBox variants={product.variants} price={product.price} preorder={product.preorder} sizeChart={sizeChart} />
            </div>

            <ul className="mt-6 space-y-1.5 text-[13px] text-muted">
              <li>Доставка по России: СДЭК, Почта России, Яндекс Доставка</li>
              <li>Оплата картой, СБП или частями</li>
              <li>Обмен и возврат — 7 дней после получения</li>
            </ul>

            <div className="mt-8 divide-y divide-line border-y border-line">
              <Accordion title="Описание" open>
                {product.description
                  ? product.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)
                  : <p>{product.title}. Оригинальный товар{product.brand ? ` бренда ${product.brand.name}` : ""}.</p>}
              </Accordion>
              <Accordion title="Характеристики">
                <dl className="grid grid-cols-[120px_1fr] gap-y-1.5">
                  {product.brand && <><dt>Бренд</dt><dd className="text-foreground">{product.brand.name}</dd></>}
                  {product.category && <><dt>Категория</dt><dd className="text-foreground">{product.category.name}</dd></>}
                  {product.color_name && <><dt>Цвет</dt><dd className="text-foreground">{product.color_name}</dd></>}
                  <dt>Для кого</dt><dd className="text-foreground">{product.gender === "women" ? "Женское" : product.gender === "unisex" ? "Унисекс" : "Мужское"}</dd>
                  {product.variants[0]?.sku && <><dt>Артикул</dt><dd className="text-foreground">{product.variants[0].sku}</dd></>}
                </dl>
              </Accordion>
              <Accordion title="Доставка и оплата">
                <p>Доставляем по всей России службами СДЭК, Почта России и Яндекс Доставка. Стоимость и сроки рассчитываются при оформлении заказа.</p>
                <p>Оплата картой, через СБП, T-Pay или частями с Яндекс Сплит.</p>
              </Accordion>
              <Accordion title="Обмен и возврат">
                <p>Вернуть или обменять товар надлежащего качества можно в течение 7 дней после получения, если сохранены товарный вид и бирки.</p>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {product.brand && (
        <ProductRail title={`Ещё ${product.brand.name}`} items={sameBrand}
          href={product.category ? routes.categoryBrand(g, product.category.handle, product.brand.handle) : routes.brand(product.brand.handle)} />
      )}
      <ProductRail title="Похожие товары" items={similar}
        href={product.category ? routes.category(g, product.category.handle) : undefined} />
      <RecentlyViewed current={toItem(product)} />

      <JsonLd data={productJsonLd(product, inStock)} />
    </>
  )
}

function Accordion({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group py-4">
      <summary className="flex items-center justify-between text-[13px]">
        {title}
        <ChevronIcon className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="prose-lf mt-3 text-[13px]">{children}</div>
    </details>
  )
}

/** Лёгкая версия товара для «Вы смотрели». */
function toItem(p: CatalogProduct): CatalogItem {
  return {
    id: p.id, handle: p.handle, title: p.title, brand: p.brand, category: p.category, gender: p.gender,
    color: p.color, color_name: p.color_name, thumbnail: p.thumbnail, hover_image: p.hover_image,
    price: p.price, compare_at: p.compare_at, sizes: p.sizes, in_stock: p.in_stock, created_at: p.created_at,
  }
}

/** Product + AggregateOffer (ТЗ, п. 7.7). Цена — обычная, без персональных скидок. */
function productJsonLd(p: CatalogProduct, inStock: boolean) {
  const url = `${SITE_URL}${routes.product(p.handle)}`
  const prices = p.variants.map((v) => v.price).filter((x) => x > 0)
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: clip(p.description ?? p.title, 500),
    image: p.images.length ? p.images : p.thumbnail ? [p.thumbnail] : [],
    sku: p.variants[0]?.sku ?? p.id,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand.name } } : {}),
    ...(p.color_name ? { color: p.color_name } : {}),
    ...(p.category ? { category: p.category.name } : {}),
    url,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "RUB",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: p.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url,
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  }
}
