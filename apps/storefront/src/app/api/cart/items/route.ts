import { NextRequest, NextResponse } from "next/server"

import { cartRequest, ensureCart, humanError, retrieveCart, syncLoyalty, toCart } from "@/lib/store-api"

/** Добавить размер в корзину. Количество проверяет Medusa по остаткам (ТЗ, п. 3.3). */
export async function POST(req: NextRequest) {
  const { variant_id, quantity = 1 } = (await req.json().catch(() => ({}))) as { variant_id?: string; quantity?: number }
  if (!variant_id || !/^variant_[A-Z0-9]+$/i.test(variant_id) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: "Неверный товар" }, { status: 400 })
  }
  let existing: { id: string; quantity: number } | undefined
  try {
    const cart = await ensureCart()
    // Размер уже в корзине — увеличиваем количество той же строки. Иначе после скидки уровня
    // (своя цена строки) Medusa создаёт новую строку и проверяет остаток только для неё:
    // последний экземпляр можно было положить в корзину несколько раз
    existing = (await retrieveCart())?.items?.find((i) => i.variant_id === variant_id)
    if (existing) {
      await cartRequest(`/store/carts/${cart.id}/line-items/${existing.id}`, "POST", { quantity: existing.quantity + quantity })
    } else {
      await cartRequest(`/store/carts/${cart.id}/line-items`, "POST", { variant_id, quantity })
    }
    // Новая позиция — по обычной цене; скидку уровня ставит сервер
    await syncLoyalty(cart.id)
    const updated = await retrieveCart()
    return NextResponse.json({ cart: updated ? toCart(updated) : null })
  } catch (e) {
    const msg = humanError(e)
    const all = existing && msg.startsWith("Этого размера больше нет")
    return NextResponse.json({ error: all ? "Больше этого размера нет — все, что есть, уже в корзине" : msg }, { status: 409 })
  }
}
