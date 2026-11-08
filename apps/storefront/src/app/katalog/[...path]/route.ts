import { getCatalog } from "@/lib/catalog"
import { routes } from "@/lib/routes"

/**
 * Адреса старого сайта /katalog/... (ТЗ, п. 7.14): 301 на новую карточку.
 * Товар ищется по ссылке из поля МС «Ссылка на товар»; не найден — 301 в каталог.
 * Обработчик, а не страница: страницы Next.js умеют только 307/308, а для переезда нужен 301.
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = `/katalog/${(await params).path.map(decodeURIComponent).join("/")}`.replace(/\/+$/, "")
  const items = await getCatalog()
  const hit = items.find((i) => i.old_path === path)
  const target = new URL(hit ? routes.product(hit.handle) : routes.gender("men"), req.url)
  return Response.redirect(target, 301)
}
