import { connection } from "next/server"

import { yandexFeed } from "@/lib/feeds"

/** Товарный фид для Яндекса (YML): Яндекс Вебмастер → «Товары и цены» или Яндекс Бизнес → «Товары». */
export async function GET() {
  await connection()
  return new Response(await yandexFeed(), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=1800" } })
}
