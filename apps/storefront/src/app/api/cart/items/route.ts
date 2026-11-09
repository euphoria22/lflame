import { NextRequest, NextResponse } from "next/server"

import { cartRequest, ensureCart, humanError, retrieveCart, syncLoyalty, toCart } from "@/lib/store-api"

/** Добавить размер в корзину. Количество проверяет Medusa по остаткам (ТЗ, п. 3.3). */
export async function POST(req: NextRequest) {
  const { variant_id, quantity = 1 } = (await req.json().catch(() => ({}))) as { variant_id?: string; quantity?: number }
  if (!variant_id || !/^variant_[A-Z0-9]+$/i.test(variant_id) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: "Неверный товар" }, { status: 400 })
  }
  try {
    const cart = await ensureCart()
    await cartRequest(`/store/carts/${cart.id}/line-items`, "POST", { variant_id, quantity })
    // Новая позиция — по обычной цене; скидку уровня ставит сервер
    await syncLoyalty(cart.id)
    const updated = await retrieveCart()
    return NextResponse.json({ cart: updated ? toCart(updated) : null })
  } catch (e) {
    return NextResponse.json({ error: humanError(e) }, { status: 409 })
  }
}
