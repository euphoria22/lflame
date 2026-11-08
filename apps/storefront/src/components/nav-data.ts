import { getCatalog, getTaxonomy } from "@/lib/catalog"
import { scopeItems } from "@/lib/listing"
import { GENDERS, GenderSlug } from "@/lib/routes"

export type NavCategory = { handle: string; name: string; count: number }
export type NavBrand = { handle: string; name: string; count: number }
export type NavGender = { slug: GenderSlug; name: string; categories: NavCategory[]; brands: NavBrand[] }

/** Данные меню: категории и топ-бренды для каждого раздела, только где есть товары. */
export async function getNav(): Promise<{ genders: NavGender[]; brands: NavBrand[]; saleCount: number }> {
  const [items, taxonomy] = await Promise.all([getCatalog(), getTaxonomy()])
  const rank = new Map(taxonomy.categories.map((c) => [c.handle, c.rank]))

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
      brands: [...brands.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    }
  })

  const all = new Map<string, NavBrand>()
  for (const i of scopeItems(items, {})) {
    if (!i.brand) continue
    const b = all.get(i.brand.handle) ?? { ...i.brand, count: 0 }
    b.count++
    all.set(i.brand.handle, b)
  }
  return {
    genders,
    brands: [...all.values()].sort((a, b) => b.count - a.count),
    saleCount: scopeItems(items, { onlySale: true }).length,
  }
}
