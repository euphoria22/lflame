import { NextRequest, NextResponse } from "next/server"

import { rateLimit } from "@/lib/rate-limit"
import { getCartId, storeFetch } from "@/lib/store-api"

type Gift = { code: string; balance: number; applied: number; expires_at: string | null } | null

/** Подарочная карта при оформлении: GET — какая применена, POST { code } — применить, DELETE — убрать */
export async function GET() {
  const cartId = await getCartId()
  if (!cartId) return NextResponse.json({ gift_card: null })
  const r = await storeFetch<{ gift_card: Gift }>(`/store/carts/${cartId}/gift-card`).catch(() => ({ gift_card: null }))
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "gift-apply", 10, 600)
  if (limited) return limited
  const { code } = (await req.json().catch(() => ({}))) as { code?: string }
  if (!String(code ?? "").trim()) return NextResponse.json({ error: "Введите код карты" }, { status: 400 })
  return run(String(code).slice(0, 40))
}

export async function DELETE() {
  return run(null)
}

async function run(code: string | null) {
  const cartId = await getCartId()
  if (!cartId) return NextResponse.json({ error: "Корзина пуста" }, { status: 400 })
  try {
    const r = await storeFetch<{ gift_card: Gift }>(`/store/carts/${cartId}/gift-card`, { method: "POST", body: { code } })
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    return NextResponse.json({ error: msg.replace(/^.*?:\s*/, "") || "Не получилось применить карту" }, { status: 400 })
  }
}
