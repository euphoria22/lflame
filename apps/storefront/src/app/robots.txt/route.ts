import { INDEXING_ENABLED, SITE_URL } from "@/lib/site"

/**
 * robots.txt (ТЗ, п. 7.8). Пока индексация не включена (staging) — сайт закрыт целиком.
 * Clean-param — директива Яндекса для служебных параметров.
 */
export function GET() {
  const body = INDEXING_ENABLED
    ? [
      "User-agent: *",
      "Disallow: /cart",
      "Disallow: /checkout",
      "Disallow: /account",
      "Disallow: /search",
      "Disallow: /favorites",
      "Disallow: /api/",
      "Disallow: /*?*sort=",
      "",
      "User-agent: Yandex",
      "Disallow: /cart",
      "Disallow: /checkout",
      "Disallow: /account",
      "Disallow: /search",
      "Disallow: /favorites",
      "Disallow: /api/",
      "Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&from&sort&view",
      "",
      `Sitemap: ${SITE_URL}/sitemap.xml`,
    ]
    : ["User-agent: *", "Disallow: /"]
  return new Response(`${body.join("\n")}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
