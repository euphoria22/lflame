/**
 * Адреса страниц (ТЗ, п. 6.1, 7.2). Все ссылки сайта строятся только через эти функции,
 * чтобы схема адресов была одна.
 */
export type GenderSlug = "men" | "women"

export const GENDERS: { slug: GenderSlug; name: string; adjective: string; forWhom: string }[] = [
  { slug: "men", name: "Мужское", adjective: "мужские", forWhom: "для мужчин" },
  { slug: "women", name: "Женское", adjective: "женские", forWhom: "для женщин" },
]

export const genderInfo = (slug: string) => GENDERS.find((g) => g.slug === slug)

export const routes = {
  home: () => "/",
  gender: (g: GenderSlug) => `/${g}`,
  category: (g: GenderSlug, category: string) => `/${g}/${category}`,
  categoryBrand: (g: GenderSlug, category: string, brand: string) => `/${g}/${category}/${brand}`,
  categoryColor: (g: GenderSlug, category: string, color: string) => `/${g}/${category}/color/${color}`,
  brands: () => "/brands",
  brand: (brand: string) => `/brands/${brand}`,
  brandGender: (brand: string, g: GenderSlug) => `/brands/${brand}/${g}`,
  newIn: (g?: GenderSlug) => (g ? `/new/${g}` : "/new"),
  outlet: (g?: GenderSlug) => (g ? `/outlet/${g}` : "/outlet"),
  product: (handle: string) => `/product/${handle}`,
  search: (q?: string) => (q ? `/search?q=${encodeURIComponent(q)}` : "/search"),
  cart: () => "/cart",
  favorites: () => "/favorites",
  account: () => "/account",
  blog: (category?: string) => (category ? `/blog?rubric=${category}` : "/blog"),
  post: (slug: string) => `/blog/${slug}`,
  page: (slug: string) => `/${slug}`,
}
