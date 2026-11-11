import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { ArrowIcon } from "@/components/icons"
import { ProductRail } from "@/components/product-rail"
import { HomeBlog } from "@/components/home-blog"
import { HomeHeroBlock } from "@/components/home-hero"
import { safeHomeHero } from "@/lib/blog"
import { getCatalog } from "@/lib/catalog"
import { discountPercent, plural } from "@/lib/format"
import { scopeItems } from "@/lib/listing"
import { routes } from "@/lib/routes"
import { pageMeta } from "@/lib/seo"
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site"
import type { CatalogItem } from "@/lib/types"

export const metadata: Metadata = pageMeta({
  title: "Мультибрендовый магазин оригинальной одежды и обуви",
  description: SITE_DESCRIPTION,
  path: "/",
})

/** Временный выбор фото для блока раздела: строго свой раздел, предпочтительно верхняя одежда. */
function heroPick(items: CatalogItem[], gender: "men" | "women"): CatalogItem | undefined {
  const own = items.filter((i) => i.in_stock && i.gender === gender && i.thumbnail)
  const preferred = ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany", "futbolki-i-longslivy"]
  for (const cat of preferred) {
    const hit = popular(own.filter((i) => i.category?.handle === cat))[0]
    if (hit) return hit
  }
  return popular(own)[0]
}

const popular = (items: CatalogItem[]) =>
  [...items].sort((a, b) => b.sizes.filter((s) => s.in_stock).length - a.sizes.filter((s) => s.in_stock).length)

/**
 * Главная (ТЗ, п. 6.1). Структура: баннер-кампания (или разделы), новинки, бренды, блог, распродажа, популярное.
 * Баннеры и блоки будут управляться из CMS (ТЗ, п. 9); пока изображения берутся из каталога.
 */
export default async function HomePage() {
  const [items, hero] = await Promise.all([getCatalog(), safeHomeHero()])
  const all = scopeItems(items, {})
  const fresh = scopeItems(items, { onlyNew: true }).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const outlet = scopeItems(items, { onlyOutlet: true })
  const maxOff = Math.max(0, ...outlet.map((i) => discountPercent(i.price, i.compare_at) ?? 0))

  const brandCounts = new Map<string, { name: string; count: number }>()
  for (const i of all) {
    if (!i.brand) continue
    const b = brandCounts.get(i.brand.handle) ?? { name: i.brand.name, count: 0 }
    b.count++
    brandCounts.set(i.brand.handle, b)
  }
  const topBrands = [...brandCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 14)

  return (
    <>
      {/* Одна H1 на странице (ТЗ, п. 7.5); визуально главную открывают блоки разделов */}
      <h1 className="sr-only">{SITE_NAME} — мультибрендовый магазин оригинальной одежды, обуви и аксессуаров</h1>

      {/* Первый экран: баннер-кампания из CMS или карточки разделов */}
      <HomeHeroBlock hero={hero} picks={{ men: heroPick(items, "men"), women: heroPick(items, "women") }} />

      <ProductRail title="Новые поступления" items={fresh} href={routes.newIn()} />

      {/* Бренды крупным шрифтом */}
      <section className="mt-20 border-y border-line px-4 py-12 md:px-8 md:py-16">
        <p className="eyebrow mb-6 text-muted">Бренды</p>
        <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[28px] leading-tight tracking-tight md:text-[44px]">
          {topBrands.map(([handle, b]) => (
            <li key={handle}>
              <Link href={routes.brand(handle)} className="transition-opacity hover:opacity-40">{b.name}</Link>
              <sup className="ml-1 text-[11px] text-subtle md:text-[13px]">{b.count}</sup>
            </li>
          ))}
        </ul>
        <Link href={routes.brands()} className="eyebrow mt-8 inline-flex items-center gap-2 underline underline-offset-4">
          Все бренды <ArrowIcon className="size-4" />
        </Link>
      </section>

      {/* Блог: последние статьи из CMS (подгружаются отдельно и не задерживают главную) */}
      <Suspense fallback={null}>
        <HomeBlog />
      </Suspense>

      {/* Outlet: вещи с небольшими дефектами */}
      {outlet.length > 0 && (
        <section className="mt-20 px-2 md:px-4">
          <Link href={routes.outlet()} className="group relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[28px] bg-foreground p-8 text-background md:min-h-[420px] md:p-14">
            <p className="eyebrow text-background/60">{outlet.length} {plural(outlet.length, ["вещь", "вещи", "вещей"])} с небольшими дефектами</p>
            <p className="text-[64px] font-medium leading-none tracking-tighter md:text-[160px]">Outlet{maxOff ? <span className="text-background/40"> −{maxOff}%</span> : null}</p>
            <span className="glass-dark inline-flex w-fit items-center gap-3 rounded-full px-6 py-3 text-[15px]">
              Смотреть <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </section>
      )}

      <ProductRail title="Популярное" items={popular(all).slice(8)} href={routes.gender("men")} />
    </>
  )
}
