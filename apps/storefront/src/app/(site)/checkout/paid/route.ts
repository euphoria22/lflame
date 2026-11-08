import { NextResponse } from "next/server"

import { SITE_URL } from "@/lib/site"
import { getCartId, setCartId, storeFetch } from "@/lib/store-api"

/**
 * Возврат с платёжной формы Т-Кассы после успешной оплаты.
 * Завершаем корзину: Medusa проверяет статус платежа в Т-Кассе (GetState) и создаёт заказ.
 * Если заказ уже создан по уведомлению Т-Кассы — Medusa вернёт его же.
 */
export async function GET() {
  const cartId = await getCartId()
  if (!cartId) return NextResponse.redirect(`${SITE_URL}/cart`, 303)
  try {
    const r = await storeFetch<{ type: string; order?: { display_id: number } }>(`/store/carts/${cartId}/complete`, { method: "POST" })
    if (r.type === "order" && r.order) {
      await setCartId(null)
      return NextResponse.redirect(`${SITE_URL}/order/confirmed?n=${r.order.display_id}&paid=1`, 303)
    }
  } catch {
    // платёж ещё не подтверждён или отклонён
  }
  return NextResponse.redirect(`${SITE_URL}/checkout?payment=pending`, 303)
}
