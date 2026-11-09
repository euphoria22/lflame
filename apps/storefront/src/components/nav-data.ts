import { safeMenuSettings } from "@/lib/blog"
import { getCatalog, getTaxonomy } from "@/lib/catalog"
import { scopeItems } from "@/lib/listing"
import { GENDERS, GenderSlug, routes } from "@/lib/routes"
import type { CatalogItem } from "@/lib/types"

export type NavCategory = { handle: string; name: string; count: number }
export type NavBrand = { handle: string; name: string; count: number }
export type NavTile = { label: string; href: string; image: string | null }
export type NavGender = { slug: GenderSlug; name: string; categories: NavCategory[]; brands: NavBrand[]; tiles: NavTile[] }

/** Плитки по умолчанию, пока в CMS ничего не выбрано (осень — зима). */
const DEFAULT_TILES = [
  { category: "kurtki", label: null, image: null },
  { category: "hudi-i-svitshoty", label: null, image: null },
  { category: "svitery-i-kardigany", label: null, image: null },
]

/** Фото для плитки меню: товар в наличии, предпочтительно верхняя одежда и трикотаж. */
function photo(list: CatalogItem[], used: Set<string>): string | null {
  const ok = list.filter((i) => i.in_stock && i.thumbnail && !used.has(i.id))
  const preferred = ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany", "futbolki-i-longslivy", "dzhinsy"]
  const hit = preferred.map((c) => ok.find((i) => i.category?.handle === c)).find(Boolean) ?? ok[0]
  if (!hit) return null
  used.add(hit.id)
  return hit.thumbnail
}

/** Данные меню: категории и топ-бренды для каждого раздела, только где есть товары. */
export async function getNav(): Promise<{ genders: NavGender[]; brands: NavBrand[]; brandTiles: NavTile[]; saleCount: number }> {
  const [items, taxonomy, menu] = await Promise.all([getCatalog(), getTaxonomy(), safeMenuSettings()])
  const rank = new Map(taxonomy.categories.map((c) => [c.handle, c.rank]))
  const used = new Set<string>()

  const genders = GENDERS.map((g) => {
    const scoped = scopeItems(items, { gender: g.slug })
    const cats = new Map<string, NavCategory>()
    const brands = new Map<string, NavBrand>()
    for (const i of scoped) {
      if (i.category) {
        const c = cats.get(i.category.handle) ?? { ...i.category, count: 0 }
        c.count++
        cats.set(i.category.handle, c)
      }
      if (i.brand) {
        const b = brands.get(i.brand.handle) ?? { ...i.brand, count: 0 }
        b.count++
        brands.set(i.brand.handle, b)
      }
    }
    return {
      slug: g.slug,
      name: g.name,
      categories: [...cats.values()].sort((a, b) => (rank.get(a.handle) ?? 0) - (rank.get(b.handle) ?? 0) || a.name.localeCompare(b.name)),
      brands: [...brands.values()].sort((a, b) => b.count - a.count).slice(0, 14).sort((a, b) => a.name.localeCompare(b.name)),
      // Плитки — сезонные категории из CMS («Меню сайта»); фото не задано — берём товар из категории
      tiles: (menu[g.slug].length ? menu[g.slug] : DEFAULT_TILES)
        .map((t) => ({ ...t, cat: cats.get(t.category) }))
        .filter((t) => t.cat)
        .map((t) => ({
          label: t.label ?? t.cat!.name,
          href: routes.category(g.slug, t.category),
          image: t.image ?? photo(scoped.filter((i) => i.category?.handle === t.category), used),
        })),
    }
  })

  const all = new Map<string, NavBrand>()
  for (const i of scopeItems(items, {})) {
    if (!i.brand) continue
    const b = all.get(i.brand.handle) ?? { ...i.brand, count: 0 }
    b.count++
    all.set(i.brand.handle, b)
  }
  const byCount = [...all.values()].sort((a, b) => b.count - a.count)
  return {
    genders,
    // Все бренды по алфавиту; две плитки — самые большие бренды
    brands: [...byCount].sort((a, b) => a.name.localeCompare(b.name)),
    brandTiles: byCount.slice(0, 2).map((b) => ({ label: b.name, href: routes.brand(b.handle), image: photo(items.filter((i) => i.brand?.handle === b.handle), used) })),
    saleCount: scopeItems(items, { onlySale: true }).length,
  }
}
