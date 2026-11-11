import { getCatalog, getTaxonomy } from "@/lib/catalog"
import { oldSiteTarget } from "@/lib/old-site"

/**
 * Адреса старого сайта laflamme.ru/catalog/… (Битрикс): 301 на новую страницу (ТЗ, п. 7.14).
 * Обработчик, а не страница: страницы Next.js умеют только 307/308, а для переезда нужен 301.
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = `/catalog/${(await params).path.map(decodeURIComponent).join("/")}`
  const [items, taxonomy] = await Promise.all([getCatalog(), getTaxonomy()])
  return Response.redirect(new URL(oldSiteTarget(path, items, taxonomy), req.url), 301)
}
