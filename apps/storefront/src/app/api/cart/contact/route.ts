import { NextRequest, NextResponse } from "next/server"

import { getCartId, retrieveCart, storeFetch } from "@/lib/store-api"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Почта и согласие на новости — в корзину сразу, как покупатель их ввёл при оформлении (до нажатия «Оформить»).
 * Нужно для письма о брошенной корзине: без почты напомнить нельзя.
 */
export async function POST(req: NextRequest) {
  const id = await getCartId()
  if (!id) return NextResponse.json({ ok: false })
  const body = (await req.json().catch(() => ({}))) as { email?: string; marketing?: boolean }
  const email = String(body.email ?? "").trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 200) return NextResponse.json({ ok: false })
  const cart = await retrieveCart().catch(() => null)
  const metadata = { ...((cart as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}), marketing_consent: Boolean(body.marketing) }
  await storeFetch(`/store/carts/${id}`, { method: "POST", body: { email, metadata } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
