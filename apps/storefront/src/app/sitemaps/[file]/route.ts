import { sitemapFiles, urlset } from "@/lib/sitemap"

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = (await params).file.replace(/\.xml$/, "")
  const files = await sitemapFiles()
  const entries = files[name]
  if (!entries) {
    return new Response("Not found", { status: 404 })
  }
  return new Response(urlset(entries), { headers: { "Content-Type": "application/xml; charset=utf-8" } })
}
