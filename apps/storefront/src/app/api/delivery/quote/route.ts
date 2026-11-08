import { NextRequest, NextResponse } from "next/server"

import { getCartId, StoreApiError, storeFetch } from "@/lib/store-api"

/** Цена и срок доставки для текущей корзины. */
export async function POST(req: NextRequest) {
  const cartId = await getCartId()
  const body = (await req.json().catch(() => ({}))) as { kind?: string; city_code?: number; postal_code?: string }
  if (!cartId || !body.kind) return NextResponse.json({ message: "Нет корзины" }, { status: 400 })
  try {
    return NextResponse.json(await storeFetch("/store/delivery/quote", { method: "POST", body: { ...body, cart_id: cartId } }))
  } catch (e) {
    return NextResponse.json({ message: e instanceof StoreApiError ? e.message : "Доставка недоступна" }, { status: 422 })
  }
}
