import { NextRequest, NextResponse } from "next/server"

import { cartRequest, getCartId, humanError, retrieveCart, storeFetch, syncLoyalty, toCart } from "@/lib/store-api"

type Ctx = { params: Promise<{ id: string }> }

/** Изменить количество или размер (variant_id: новая позиция того же количества вместо старой). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const cartId = await getCartId()
  const { quantity, variant_id } = (await req.json().catch(() => ({}))) as { quantity?: number; variant_id?: string }
  if (cartId && variant_id) {
    if (!/^variant_[A-Z0-9]+$/i.test(variant_id)) return NextResponse.json({ error: "Неверный размер" }, { status: 400 })
    try {
      const cart = await retrieveCart()
      const line = cart?.items?.find((i) => i.id === id)
      if (!line) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 })
      if (line.variant_id !== variant_id) {
        // Сначала добавляем новый размер: если его нет в наличии, старая позиция останется
        await cartRequest(`/store/carts/${cartId}/line-items`, "POST", { variant_id, quantity: line.quantity })
        await storeFetch(`/store/carts/${cartId}/line-items/${id}`, { method: "DELETE" })
        await syncLoyalty(cartId)
      }
      const updated = await retrieveCart()
      return NextResponse.json({ cart: updated ? toCart(updated) : null })
    } catch (e) {
      return NextResponse.json({ error: humanError(e) }, { status: 409 })
    }
  }
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
