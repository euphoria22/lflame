import { connection } from "next/server"

import { indexNowKey } from "@/lib/indexnow"
import { INDEXING_ENABLED } from "@/lib/site"

/** Файл подтверждения ключа IndexNow: Яндекс проверяет, что уведомления шлёт владелец сайта. */
export async function GET() {
  await connection()
  const key = indexNowKey()
  if (!INDEXING_ENABLED || !key) return new Response("Not found", { status: 404 })
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
