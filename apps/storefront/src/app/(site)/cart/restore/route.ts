import { NextRequest, NextResponse } from "next/server"

import { SITE_URL } from "@/lib/site"
import { applyPromo, setCartId, storeFetch } from "@/lib/store-api"

/**
 * «Вернуться к корзине» из письма о брошенной корзине: проверяем подпись ссылки, ставим эту корзину покупателю
 * (на любом устройстве) и применяем промокод из письма. Корзина уже оформлена или ссылка неверна — просто в корзину.
 */
export async function GET(req: NextRequest) {
  const c = req.nextUrl.searchParams.get("c") ?? ""
  const t = req.nextUrl.searchParams.get("t") ?? ""
  try {
    const r = await storeFetch<{ ok: boolean; code: string | null; completed: boolean }>("/store/abandoned/restore", { method: "POST", body: { cart_id: c, token: t } })
    if (r.ok && !r.completed) {
      await setCartId(c)
      // Как поле «Есть промокод?» в корзине: код виден, со скидкой Laflamme Club не суммируется
      if (r.code) await applyPromo(c, r.code).catch(() => null)
    }
  } catch {
    // неверная или старая ссылка — открываем корзину как есть
  }
  return NextResponse.redirect(`${SITE_URL}/cart`, 303)
}
