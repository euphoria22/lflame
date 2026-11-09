import { NextResponse } from "next/server"

import { getCartId, setAuthToken, syncLoyalty } from "@/lib/store-api"

export async function POST() {
  await setAuthToken(null)
  // Без входа скидка уровня не действует — возвращаем обычные цены
  const cartId = await getCartId()
  if (cartId) await syncLoyalty(cartId)
  return NextResponse.json({ ok: true })
}
