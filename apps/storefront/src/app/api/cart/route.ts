import { NextResponse } from "next/server"

import { retrieveCart, toCart } from "@/lib/store-api"

/** Текущая корзина покупателя. */
export async function GET() {
  const cart = await retrieveCart()
  return NextResponse.json({ cart: cart ? toCart(cart) : null }, { headers: { "Cache-Control": "no-store" } })
}
