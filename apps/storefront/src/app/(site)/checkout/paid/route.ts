import { NextResponse } from "next/server"

import { SITE_URL } from "@/lib/site"
import { getCartId, setCartId, storeFetch } from "@/lib/store-api"

/**
 * Возврат с платёжной формы Т-Кассы или Яндекс Пэй (Сплит) после успешной оплаты.
 * Завершаем корзину: Medusa проверяет статус платежа у платёжной системы и создаёт заказ.
 * Если заказ уже создан по уведомлению Т-Кассы — Medusa вернёт его же.
 */
export async function GET() {
  const cartId = await getCartId()
  if (!cartId) return NextResponse.redirect(`${SITE_URL}/cart`, 303)
  // Уведомление Т-Кассы приходит одновременно с возвратом покупателя: если первая попытка не прошла
  // (корзину в эту секунду оформляет уведомление), пробуем ещё дважды — второй раз Medusa вернёт уже созданный заказ
  for (const wait of [0, 2000, 4000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait))
    try {
      const r = await storeFetch<{ type: string; order?: { display_id: number } }>(`/store/carts/${cartId}/complete`, { method: "POST" })
      if (r.type === "order" && r.order) {
        await setCartId(null)
        return NextResponse.redirect(`${SITE_URL}/order/confirmed?n=${r.order.display_id}&paid=1`, 303)
      }
    } catch {
      // платёж ещё не подтверждён, корзину оформляет уведомление или оформление не прошло — пробуем ещё раз
    }
  }
  return NextResponse.redirect(`${SITE_URL}/checkout?payment=pending`, 303)
}
