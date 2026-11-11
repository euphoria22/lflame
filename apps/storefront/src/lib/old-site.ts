import type { CatalogItem, Taxonomy } from "./types"
import { routes, type GenderSlug } from "./routes"

/**
 * Переезд со старого сайта (Битрикс, laflamme.ru/catalog/…): куда вести старый адрес (ТЗ, п. 7.14).
 * Товар — по ссылке из поля МС «Ссылка на товар», иначе по названию в адресе (с поправкой на транслитерацию:
 * старый сайт писал «khudi», новый — «hudi»). Нет товара — категория с брендом из адреса, затем категория.
 * Нечёткое сходство не используется: оно путает цвета, и покупатель попал бы на чужой товар.
 */
export function slugKey(s: string): string {
  return s.toLowerCase().replace(/kh/g, "h").replace(/yeezy[-_]x[-_]gap/g, "yeezy-gap").replace(/[^a-z0-9]/g, "")
}

const OLD_CATEGORY: Record<string, string> = { cumki_i_ryukzaki: "sumki-i-ryukzaki", khudi_i_svitshoty: "hudi-i-svitshoty" }
const OLD_BRAND: Record<string, string> = { "yeezy-x-gap": "yeezy-gap" }

export function oldSiteTarget(path: string, items: CatalogItem[], taxonomy: Taxonomy): string {
  const parts = path.replace(/^\/+|\/+$/g, "").split("/").slice(1) // без «catalog»
  const cats = new Set(taxonomy.categories.map((c) => c.handle))
  // Только бренды, товары которых сейчас есть на сайте: пустая страница бренда хуже общего списка
  const present = new Set(items.map((i) => i.brand?.handle).filter(Boolean))
  const brands = taxonomy.brands.map((b) => b.handle).filter((h) => present.has(h))
  const men: GenderSlug = "men"
  if (!parts.length) return routes.gender(men)

  // Бренд: /catalog/brand-stone-island
  if (parts[0].startsWith("brand-")) {
    const slug = parts[0].slice("brand-".length)
    const handle = OLD_BRAND[slug] ?? slug
    return brands.includes(handle) ? routes.brand(handle) : routes.brands()
  }

  // Категория: /catalog/khudi_i_svitshoty
  const cat = OLD_CATEGORY[parts[0]] ?? parts[0].replace(/_/g, "-")
  const category = cats.has(cat) ? cat : null

  // Товар: /catalog/<категория>/product/<slug>
  if (parts[1] === "product" && parts[2]) {
    const full = `/catalog/${parts.join("/")}`
    const byField = items.find((i) => i.old_path && i.old_path.replace(/\/+$/, "") === full)
    if (byField) return routes.product(byField.handle)
    const key = slugKey(parts[2])
    const byName = items.find((i) => slugKey(i.handle) === key)
    if (byName) return routes.product(byName.handle)
    // Бренд из адреса — самый длинный совпавший, чтобы «calvin-klein-jeans» не стал «calvin-klein»
    const slug = `-${parts[2].replace(/_/g, "-")}-`
    const brand = brands.filter((b) => slug.includes(`-${b}-`) || slugKey(slug).includes(slugKey(b))).sort((a, b) => b.length - a.length)[0]
    if (category && brand) return routes.categoryBrand(men, category, brand)
    if (category) return routes.category(men, category)
    return brand ? routes.brand(brand) : routes.gender(men)
  }
  return category ? routes.category(men, category) : routes.gender(men)
}
