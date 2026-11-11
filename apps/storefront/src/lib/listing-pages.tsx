import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CatalogListing, SearchParams } from "@/components/catalog-listing"
import { getCatalog, getTaxonomy } from "./catalog"
import { formatPrice, plural } from "./format"
import { hasFilterParams, LANDING_MIN_ITEMS, parseFilters, scopeItems, ListingScope } from "./listing"
import { GENDERS, GenderSlug, genderInfo, routes } from "./routes"
import { pageMeta } from "./seo"
import { SITE_NAME } from "./site"
import type { CatalogItem } from "./types"

/**
 * Страницы каталога по схеме адресов ТЗ (п. 6.1, 7.2): раздел, категория, категория + бренд,
 * бренд, бренд + раздел, новинки, распродажа. Шаблоны мета-тегов — п. 7.5,
 * индексация посадочных — п. 7.3 (не меньше LANDING_MIN_ITEMS товаров, без параметров фильтра).
 */

type Ctx = {
  scope: ListingScope
  basePath: string
  h1: string
  title: string
  description: string
  crumbs: { name: string; href: string }[]
  chips?: { label: string; href: string; active?: boolean }[]
  /** Переключатель разделов в верху фильтра (обратная связь 08.11.2026) */
  genderLinks?: { label: string; href: string; active?: boolean }[]
  intro?: string | null
  seoText?: string | null
  showBrandFilter?: boolean
}

function describe(h1: string, items: CatalogItem[]): string {
  const min = items.length ? Math.min(...items.map((i) => i.price)) : 0
  const count = items.length
  return `${h1} в интернет-магазине ${SITE_NAME}: ${count} ${plural(count, ["модель", "модели", "моделей"])}${min ? ` по цене от ${formatPrice(min)}` : ""}. Оригинал, доставка по России, оплата частями.`
}

function brandChips(items: CatalogItem[], href: (brand: string) => string, activeBrand?: string) {
  const counts = new Map<string, { name: string; count: number }>()
  for (const i of items) {
    if (!i.brand) continue
    const c = counts.get(i.brand.handle) ?? { name: i.brand.name, count: 0 }
    c.count++
    counts.set(i.brand.handle, c)
  }
  return [...counts.entries()]
    .filter(([, v]) => v.count >= LANDING_MIN_ITEMS)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 16)
    .map(([handle, v]) => ({ label: v.name, href: href(handle), active: handle === activeBrand }))
}

function categoryChips(items: CatalogItem[], href: (cat: string) => string, active?: string) {
  const counts = new Map<string, { name: string; count: number }>()
  for (const i of items) {
    if (!i.category) continue
    const c = counts.get(i.category.handle) ?? { name: i.category.name, count: 0 }
    c.count++
    counts.set(i.category.handle, c)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([handle, v]) => ({ label: v.name, href: href(handle), active: handle === active }))
}

async function resolve(kind: string, p: Record<string, string>): Promise<Ctx | null> {
  const [items, taxonomy] = await Promise.all([getCatalog(), getTaxonomy()])
  const g = p.gender ? genderInfo(p.gender) : undefined
  if (p.gender && !g) return null
  const cat = p.category ? taxonomy.categories.find((c) => c.handle === p.category) : undefined
  if (p.category && !cat) return null
  const brand = p.brand ? taxonomy.brands.find((b) => b.handle === p.brand) : undefined
  if (p.brand && !brand) return null

  switch (kind) {
    case "gender": {
      const scope = { gender: g!.slug }
      const scoped = scopeItems(items, scope)
      return {
        scope, basePath: routes.gender(g!.slug), h1: g!.name,
        title: `${g!.name === "Мужское" ? "Мужская" : "Женская"} одежда, обувь и аксессуары — купить`,
        description: describe(`${g!.name === "Мужское" ? "Мужская" : "Женская"} одежда`, scoped),
        crumbs: [{ name: g!.name, href: routes.gender(g!.slug) }],
        // Категории выбираются в фильтре; сверху — популярные бренды раздела (обратная связь 08.11.2026)
        chips: brandChips(scoped, (b) => routes.brandGender(b, g!.slug)),
        genderLinks: GENDERS.map((x) => ({ label: x.name, href: routes.gender(x.slug), active: x.slug === g!.slug })),
      }
    }
    case "category": {
      const scope = { gender: g!.slug, category: cat!.handle }
      const scoped = scopeItems(items, scope)
      const h1 = `${cat!.name} ${g!.adjective}`
      return {
        scope, basePath: routes.category(g!.slug, cat!.handle), h1,
        title: cat!.seo_title ?? `${cat!.name} ${g!.forWhom} — купить в интернет-магазине`,
        description: cat!.seo_description ?? describe(h1, scoped),
        crumbs: [{ name: g!.name, href: routes.gender(g!.slug) }, { name: cat!.name, href: routes.category(g!.slug, cat!.handle) }],
        chips: brandChips(scoped, (b) => routes.categoryBrand(g!.slug, cat!.handle, b)),
        genderLinks: GENDERS.map((x) => ({ label: x.name, href: routes.category(x.slug, cat!.handle), active: x.slug === g!.slug })),
        intro: cat!.description, seoText: cat!.seo_text,
      }
    }
    case "categoryBrand": {
      const scope = { gender: g!.slug, category: cat!.handle, brand: brand!.handle }
      const scoped = scopeItems(items, scope)
      const h1 = `${cat!.name} ${brand!.name}`
      const parent = scopeItems(items, { gender: g!.slug, category: cat!.handle })
      return {
        scope, basePath: routes.categoryBrand(g!.slug, cat!.handle, brand!.handle), h1,
        title: `${cat!.name} ${brand!.name} ${g!.adjective} — купить оригинал`,
        description: describe(`${h1} ${g!.adjective}`, scoped),
        crumbs: [
          { name: g!.name, href: routes.gender(g!.slug) },
          { name: cat!.name, href: routes.category(g!.slug, cat!.handle) },
          { name: brand!.name, href: routes.categoryBrand(g!.slug, cat!.handle, brand!.handle) },
        ],
        chips: brandChips(parent, (b) => routes.categoryBrand(g!.slug, cat!.handle, b), brand!.handle),
        genderLinks: GENDERS.map((x) => ({ label: x.name, href: routes.categoryBrand(x.slug, cat!.handle, brand!.handle), active: x.slug === g!.slug })),
        showBrandFilter: false,
      }
    }
    case "brand": {
      const scope = { brand: brand!.handle }
      const scoped = scopeItems(items, scope)
      return {
        scope, basePath: routes.brand(brand!.handle), h1: brand!.name,
        title: brand!.seo_title ?? `${brand!.name} — одежда и обувь, купить`,
        description: brand!.seo_description ?? describe(brand!.name, scoped),
        crumbs: [{ name: "Бренды", href: routes.brands() }, { name: brand!.name, href: routes.brand(brand!.handle) }],
        genderLinks: [
          { label: "Все", href: routes.brand(brand!.handle), active: true },
          ...GENDERS.filter((x) => scopeItems(scoped, { gender: x.slug }).length).map((x) => ({ label: x.name, href: routes.brandGender(brand!.handle, x.slug) })),
        ],
        intro: brand!.short_description, seoText: brand!.seo_text ?? brand!.description,
        showBrandFilter: false,
      }
    }
    case "brandGender": {
      const scope = { brand: brand!.handle, gender: g!.slug }
      const scoped = scopeItems(items, scope)
      const h1 = `${brand!.name} ${g!.forWhom}`
      return {
        scope, basePath: routes.brandGender(brand!.handle, g!.slug), h1,
        title: `${brand!.name} ${g!.forWhom} — купить`,
        description: describe(h1, scoped),
        crumbs: [
          { name: "Бренды", href: routes.brands() },
          { name: brand!.name, href: routes.brand(brand!.handle) },
          { name: g!.name, href: routes.brandGender(brand!.handle, g!.slug) },
        ],
        chips: categoryChips(scoped, (c) => routes.categoryBrand(g!.slug, c, brand!.handle)),
        genderLinks: [
          { label: "Все", href: routes.brand(brand!.handle) },
          ...GENDERS.map((x) => ({ label: x.name, href: routes.brandGender(brand!.handle, x.slug), active: x.slug === g!.slug })),
        ],
        showBrandFilter: false,
      }
    }
    case "new":
    case "outlet": {
      const isOutlet = kind === "outlet"
      const scope = { gender: g?.slug, onlyNew: !isOutlet, onlyOutlet: isOutlet }
      const scoped = scopeItems(items, scope)
      const base = isOutlet ? "Outlet" : "Новинки"
      const link = (x?: GenderSlug) => (isOutlet ? routes.outlet(x) : routes.newIn(x))
      const h1 = g ? `${base}: ${g.name.toLowerCase()}` : base
      return {
        scope, basePath: link(g?.slug), h1,
        title: `${h1} — ${isOutlet ? "оригинальные вещи с небольшими дефектами по сниженной цене" : "новые поступления"}`,
        description: describe(h1, scoped),
        ...(isOutlet ? { intro: "Оригинальные вещи с небольшими дефектами — затяжкой, следами примерки, повреждённой упаковкой — по сниженной цене. Что именно с вещью, написано в её карточке." } : {}),
        crumbs: [
          { name: base, href: link() },
          ...(g ? [{ name: g.name, href: link(g.slug) }] : []),
        ],
        genderLinks: [
          { label: "Все", href: link(), active: !g },
          ...GENDERS.map((x) => ({ label: x.name, href: link(x.slug), active: x.slug === g?.slug })),
        ],
      }
    }
  }
  return null
}

export type ListingKind = "gender" | "category" | "categoryBrand" | "brand" | "brandGender" | "new" | "outlet"

type RouteProps = { params: Promise<Record<string, string>>; searchParams: Promise<SearchParams> }

/** Фабрика страницы: default + generateMetadata для одного вида листинга. */
export function listingPage(kind: ListingKind, fixed: Record<string, string> = {}) {
  async function load(params: Promise<Record<string, string>>) {
    const p = { ...(await params), ...fixed }
    return resolve(kind, p)
  }

  async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
    const ctx = await load(params)
    if (!ctx) return {}
    const filters = parseFilters(await searchParams)
    const count = scopeItems(await getCatalog(), ctx.scope).length
    return pageMeta({
      title: ctx.title,
      description: ctx.description,
      path: ctx.basePath,
      page: filters.page,
      index: !hasFilterParams(filters) && count >= LANDING_MIN_ITEMS,
    })
  }

  async function Page({ params, searchParams }: RouteProps) {
    const ctx = await load(params)
    if (!ctx) notFound()
    return <CatalogListing {...ctx} searchParams={searchParams} />
  }

  return { generateMetadata, Page }
}

/** Все посадочные страницы с товарами: для generateStaticParams и sitemap (п. 7.8). */
export async function listingPaths(): Promise<{ path: string; count: number }[]> {
  const [items, taxonomy] = await Promise.all([getCatalog(), getTaxonomy()])
  const out: { path: string; count: number }[] = []
  const add = (path: string, scope: ListingScope) => out.push({ path, count: scopeItems(items, scope).length })
  for (const g of GENDERS) {
    add(routes.gender(g.slug), { gender: g.slug })
    add(routes.newIn(g.slug), { gender: g.slug, onlyNew: true })
    add(routes.outlet(g.slug), { gender: g.slug, onlyOutlet: true })
    for (const c of taxonomy.categories) {
      add(routes.category(g.slug, c.handle), { gender: g.slug, category: c.handle })
      for (const b of taxonomy.brands) {
        add(routes.categoryBrand(g.slug, c.handle, b.handle), { gender: g.slug, category: c.handle, brand: b.handle })
      }
    }
    for (const b of taxonomy.brands) add(routes.brandGender(b.handle, g.slug), { gender: g.slug, brand: b.handle })
  }
  for (const b of taxonomy.brands) add(routes.brand(b.handle), { brand: b.handle })
  add(routes.newIn(), { onlyNew: true })
  add(routes.outlet(), { onlyOutlet: true })
  return out.filter((x) => x.count > 0)
}

export type { GenderSlug }

/** Параметры для generateStaticParams: только страницы с товарами (п. 7.3). */
export async function staticParams(pattern: RegExp, names: string[]): Promise<Record<string, string>[]> {
  const paths = await listingPaths()
  const params = paths
    .map((p) => p.path.match(pattern))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => Object.fromEntries(names.map((n, i) => [n, m[i + 1]])))
  // Пустой каталог (первый запуск сервера): Next.js требует хотя бы один адрес — заглушка отдаёт 404
  return params.length ? params : [Object.fromEntries(names.map((n) => [n, "_"]))]
}
