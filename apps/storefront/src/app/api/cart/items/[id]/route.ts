import { NextRequest, NextResponse } from "next/server"

import { cartRequest, getCartId, humanError, retrieveCart, storeFetch, toCart } from "@/lib/store-api"

type Ctx = { params: Promise<{ id: string }> }

/** Изменить количество. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const cartId = await getCartId()
  const { quantity } = (await req.json().catch(() => ({}))) as { quantity?: number }
  if (!cartId || !quantity || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: "Неверное количество" }, { status: 400 })
  }
  try {
    const cart = await cartRequest(`/store/carts/${cartId}/line-items/${id}`, "POST", { quantity })
    return NextResponse.json({ cart: toCart(cart) })
  } catch (e) {
    return NextResponse.json({ error: humanError(e) }, { status: 409 })
  }
}

/** Удалить позицию. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const cartId = await getCartId()
  if (!cartId) return NextResponse.json({ cart: null })
  try {
    await storeFetch(`/store/carts/${cartId}/line-items/${id}`, { method: "DELETE" })
    const cart = await retrieveCart()
    return NextResponse.json({ cart: cart ? toCart(cart) : null })
  } catch (e) {
    return NextResponse.json({ error: humanError(e) }, { status: 409 })
  }
}
