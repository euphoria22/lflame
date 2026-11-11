import { connection } from "next/server"

import { googleFeed } from "@/lib/feeds"

/** Товарный фид для Google Merchant Center (бесплатные товарные объявления в Google Покупках). */
export async function GET() {
  await connection()
  return new Response(await googleFeed(), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=1800" } })
}
