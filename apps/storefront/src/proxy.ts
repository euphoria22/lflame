import { NextRequest, NextResponse } from "next/server"

/**
 * Нормализация адресов одним 301-редиректом (ТЗ, п. 7.2, 7.4, 7.9):
 * слеш на конце, заглавные буквы, двойные слеши, index.html, ?page=1.
 * http→https и www→без www — на уровне веб-сервера (nginx).
 */
export function proxy(req: NextRequest) {
  // Обычный URL, а не req.nextUrl: NextURL сам дописывает слеш по настройкам и даёт цикл
  const url = new URL(req.url)
  let path = url.pathname
  let changed = false

  const fixed = path
    .replace(/\/{2,}/g, "/")
    .replace(/\/index\.html?$/i, "/")
  if (fixed !== path) { path = fixed; changed = true }

  if (path.length > 1 && path.endsWith("/")) { path = path.replace(/\/+$/, ""); changed = true }

  // Регистр приводится только для страниц сайта (не для файлов и API)
  // Личный кабинет не трогаем: в номерах заказов есть заглавные буквы (order_01M6Y…)
  if (path !== path.toLowerCase() && !/\.[a-z0-9]+$/i.test(path) && !path.startsWith("/account/")) { path = path.toLowerCase(); changed = true }

  // Адреса прежнего сайта, на которые ссылаются оферта и политика
  const OLD: Record<string, string> = { "/policy": "/privacy" }
  if (OLD[path]) { path = OLD[path]; changed = true }
  // Раздел Sale переименован в Outlet
  if (path === "/sale" || path.startsWith("/sale/")) { path = path.replace(/^\/sale/, "/outlet"); changed = true }

  if (url.searchParams.get("page") === "1") { url.searchParams.delete("page"); changed = true }

  if (!changed) return NextResponse.next()
  url.pathname = path || "/"
  return NextResponse.redirect(url, 301)
}

export const config = {
  // Служебные пути Next.js, картинки и файлы — без обработки
  matcher: ["/((?!_next/|api/|favicon\\.ico|icon|apple-icon|robots\\.txt|sitemap).*)"],
}
