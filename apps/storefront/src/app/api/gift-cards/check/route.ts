import { NextRequest, NextResponse } from "next/server"

import { rateLimit } from "@/lib/rate-limit"
import { storeFetch } from "@/lib/store-api"

/** Баланс подарочной карты по коду. Ограничение частоты — чтобы коды нельзя было перебирать. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "gift-check", 10, 600)
  if (limited) return limited
  const { code } = (await req.json().catch(() => ({}))) as { code?: string }
  if (!String(code ?? "").trim()) return NextResponse.json({ error: "Введите код карты" }, { status: 400 })
  try {
    return NextResponse.json(await storeFetch("/store/gift-cards/check", { method: "POST", body: { code: String(code).slice(0, 40) } }), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Не получилось проверить карту. Попробуйте ещё раз." }, { status: 502 })
  }
}
