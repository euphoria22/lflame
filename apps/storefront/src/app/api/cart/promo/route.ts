import { NextRequest, NextResponse } from "next/server"

import { applyPromo, getCartId, retrieveCart, toCart } from "@/lib/store-api"

/** Промокод в корзине: POST { code } — применить, DELETE — убрать. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string }
  const code = String(body.code ?? "").trim().slice(0, 40)
  if (!code) return NextResponse.json({ error: "Введите промокод" }, { status: 400 })
  return run(code)
}

export async function DELETE() {
  return run(null)
}

async function run(code: string | null) {
  const cartId = await getCartId()
  if (!cartId) return NextResponse.json({ error: "Корзина пуста" }, { status: 400 })
  let error: string | null
  try {
    error = await applyPromo(cartId, code)
  } catch {
    error = "Не получилось применить промокод. Попробуйте ещё раз."
  }
  const cart = await retrieveCart()
  return NextResponse.json({ cart: cart ? toCart(cart) : null, promoError: error }, { headers: { "Cache-Control": "no-store" } })
}
