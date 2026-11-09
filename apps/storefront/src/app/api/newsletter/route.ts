import { NextRequest, NextResponse } from "next/server"

import { StoreApiError, storeFetch } from "@/lib/store-api"

/** Настройки формы подписки (показывать ли, какая скидка). */
export async function GET() {
  try {
    return NextResponse.json(await storeFetch<{ enabled: boolean; discount_pct: number }>("/store/newsletter"), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ enabled: false, discount_pct: 0 })
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string }
  const email = String(body.email ?? "").trim().slice(0, 200)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Проверьте email" }, { status: 400 })
  try {
    return NextResponse.json(await storeFetch("/store/newsletter", { method: "POST", body: { email, source: "footer" } }))
  } catch (e) {
    return NextResponse.json({ error: e instanceof StoreApiError && e.status < 500 ? e.message : "Не получилось. Попробуйте ещё раз." }, { status: 400 })
  }
}
