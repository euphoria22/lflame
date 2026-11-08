import { SITE_URL } from "@/lib/site"
import { sitemapFiles } from "@/lib/sitemap"

/** Индекс карт сайта (ТЗ, п. 7.8). */
export async function GET() {
  const files = Object.keys(await sitemapFiles())
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files
    .map((f) => `  <sitemap><loc>${SITE_URL}/sitemaps/${f}.xml</loc></sitemap>`)
    .join("\n")}\n</sitemapindex>\n`
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } })
}
