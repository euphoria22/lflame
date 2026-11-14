import { NextRequest, NextResponse } from "next/server"

import { rateLimit } from "@/lib/rate-limit"
import { storeFetch } from "@/lib/store-api"

/** События листингов (показ, клик, корзина, визит) для умной сортировки: пачкой, без данных о покупателе */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "events", 120, 60)
  if (limited) return limited
  const body = (await req.json().catch(() => ({}))) as { events?: unknown }
  const events = Array.isArray(body.events) ? body.events.slice(0, 200) : []
  if (events.length) await storeFetch("/store/sort/events", { method: "POST", body: { events } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
