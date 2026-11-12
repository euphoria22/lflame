import { NextRequest, NextResponse } from "next/server"

import { rateLimit } from "@/lib/rate-limit"

import { StoreApiError, storeFetch } from "@/lib/store-api"

export async function POST(req: NextRequest) {
  // Писем с кодом: не больше 5 за 10 минут и 20 за сутки с одного адреса
  const limited = rateLimit(req, "code", 5, 600) ?? rateLimit(req, "code-day", 20, 86_400)
  if (limited) return limited
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  try {
    await storeFetch("/store/account/code", { method: "POST", body: { email } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const status = e instanceof StoreApiError ? e.status : 502
    return NextResponse.json({ error: e instanceof StoreApiError ? e.message : "Не удалось отправить код" }, { status })
  }
}
