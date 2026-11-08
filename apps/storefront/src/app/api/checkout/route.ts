import { NextRequest, NextResponse } from "next/server"

import { CheckoutInput, normalizePhone, validateCheckout } from "@/lib/checkout"
import { cartRequest, retrieveCart, setCartId, storeFetch } from "@/lib/store-api"

/**
 * Оформление заказа (ТЗ, п. 6.4): контакты → способ получения → оплата → заказ.
 * Сейчас: самовывоз и тестовая оплата (pp_system_default). На этапе 4 подключаются
 * службы доставки (ApiShip/СДЭК) и Т-Касса.
 */
export async function POST(req: NextRequest) {
  const input = (await req.json().catch(() => ({}))) as Partial<CheckoutInput>
  const errors = validateCheckout(input)
  if (Object.keys(errors).length) {
    return NextResponse.json({ errors }, { status: 400 })
  }
  const cart = await retrieveCart()
  if (!cart?.items?.length) {
    return NextResponse.json({ error: "Корзина пуста" }, { status: 400 })
  }

  const phone = normalizePhone(input.phone!)!
  const address = {
    first_name: input.first_name!.trim().slice(0, 100),
    last_name: input.last_name!.trim().slice(0, 100),
    phone,
    address_1: "Самовывоз из магазина",
    city: "Москва",
    country_code: "ru",
  }

  try {
    await cartRequest(`/store/carts/${cart.id}`, "POST", {
      email: input.email!.trim().toLowerCase(),
      shipping_address: address,
      billing_address: address,
      metadata: {
        comment: input.comment?.trim().slice(0, 1000) || null,
        // ТЗ, п. 6.4, 8.7: отдельное согласие на обработку ПД и на рассылки — с датой
        pd_consent_at: new Date().toISOString(),
        marketing_consent: Boolean(input.marketing),
      },
    })

    const { shipping_options } = await storeFetch<{ shipping_options: { id: string; name: string }[] }>(
      `/store/shipping-options?cart_id=${cart.id}`
    )
    const pickup = shipping_options[0]
    if (!pickup) throw new Error("Нет способов получения")
    await cartRequest(`/store/carts/${cart.id}/shipping-methods`, "POST", { option_id: pickup.id })

    const { payment_collection } = await storeFetch<{ payment_collection: { id: string } }>("/store/payment-collections", {
      method: "POST",
      body: { cart_id: cart.id },
    })
    await storeFetch(`/store/payment-collections/${payment_collection.id}/payment-sessions`, {
      method: "POST",
      body: { provider_id: "pp_system_default" },
    })

    const result = await storeFetch<{ type: "order" | "cart"; order?: { id: string; display_id: number }; error?: { message: string } }>(
      `/store/carts/${cart.id}/complete`,
      { method: "POST" }
    )
    if (result.type !== "order" || !result.order) {
      throw new Error(result.error?.message ?? "Заказ не создан")
    }
    await setCartId(null)
    return NextResponse.json({ order: { id: result.order.id, number: result.order.display_id } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const human = /inventory|stock|insufficient/i.test(msg)
      ? "Пока вы оформляли заказ, часть товаров закончилась. Проверьте корзину."
      : "Не получилось оформить заказ. Попробуйте ещё раз или позвоните нам."
    return NextResponse.json({ error: human }, { status: 409 })
  }
}
