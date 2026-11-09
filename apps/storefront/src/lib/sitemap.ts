import { listInfoPages, safePosts } from "./blog"
import { getCatalog } from "./catalog"
import { LANDING_MIN_ITEMS } from "./listing"
import { listingPaths } from "./listing-pages"
import { routes } from "./routes"
import { SITE_URL } from "./site"

/** Карта сайта (ТЗ, п. 7.8): только канонические индексируемые адреса, до 10 000 в файле. */
export const SITEMAP_CHUNK = 10000

export type SitemapEntry = { loc: string; lastmod?: string }

export async function sitemapFiles(): Promise<Record<string, SitemapEntry[]>> {
  const items = await getCatalog()
  const products = items.map((i) => ({ loc: `${SITE_URL}${routes.product(i.handle)}`, lastmod: i.created_at }))
  const landings = (await listingPaths())
    .filter((p) => p.count >= LANDING_MIN_ITEMS)
    .map((p) => ({ loc: `${SITE_URL}${p.path}` }))

  const files: Record<string, SitemapEntry[]> = {
    pages: [{ loc: `${SITE_URL}/` }, { loc: `${SITE_URL}${routes.brands()}` }, { loc: `${SITE_URL}/loyalty` }, { loc: `${SITE_URL}/loyalty/rules` },
      ...(await listInfoPages().catch(() => [])).map((slug) => ({ loc: `${SITE_URL}${routes.page(slug)}` }))],
    landings,
    blog: [{ loc: `${SITE_URL}${routes.blog()}` }, ...(await safePosts()).map((p) => ({ loc: `${SITE_URL}${routes.post(p.slug)}`, lastmod: p.publishedAt ?? undefined }))],
  }
  for (let i = 0; i < products.length; i += SITEMAP_CHUNK) {
    files[`products-${i / SITEMAP_CHUNK + 1}`] = products.slice(i, i + SITEMAP_CHUNK)
  }
  return files
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")

export function urlset(entries: SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((e) => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ""}</url>`)
    .join("\n")}\n</urlset>\n`
}
