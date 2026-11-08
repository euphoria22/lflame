import { NextRequest, NextResponse } from "next/server"

import { CheckoutInput, normalizePhone, validateCheckout } from "@/lib/checkout"
import { DeliveryChoice, PICKUP, validateDelivery } from "@/lib/delivery"
import { cartRequest, retrieveCart, setCartId, storeFetch } from "@/lib/store-api"

/**
 * Оформление заказа (ТЗ, п. 6.4): контакты → способ получения → оплата → заказ.
 * Получение: самовывоз в Омске, СДЭК (пункт выдачи, курьер), Почта России.
 * Оплата пока «при получении» (pp_system_default); Т-Касса — следующим шагом.
 */
export async function POST(req: NextRequest) {
  const input = (await req.json().catch(() => ({}))) as Partial<CheckoutInput> & { delivery?: Partial<DeliveryChoice> }
  const errors = validateCheckout(input)
  const deliveryError = validateDelivery(input.delivery)
  if (deliveryError) errors.delivery = deliveryError
  if (Object.keys(errors).length) {
    return NextResponse.json({ errors }, { status: 400 })
  }
  const cart = await retrieveCart()
  if (!cart?.items?.length) {
    return NextResponse.json({ error: "Корзина пуста" }, { status: 400 })
  }

  const phone = normalizePhone(input.phone!)!
  const d = input.delivery as DeliveryChoice
  const clean = (s: string | undefined, n = 200) => (s ?? "").trim().slice(0, n)
  const place =
    d.kind === "pickup" ? { address_1: `Самовывоз: ${PICKUP.address}`, city: "Омск" }
      : d.kind === "cdek-pvz" ? { address_1: `ПВЗ СДЭК ${clean(d.pvz_code, 20)}: ${clean(d.pvz_address)}`, city: clean(d.city, 100), postal_code: clean(d.postal_code, 6) || undefined }
        : d.kind === "cdek-door" ? { address_1: clean(d.address), city: clean(d.city, 100) }
          : { address_1: clean(d.address), city: clean(d.city, 100), postal_code: clean(d.postal_code, 6) }
  const address = {
    first_name: input.first_name!.trim().slice(0, 100),
    last_name: input.last_name!.trim().slice(0, 100),
    phone,
    country_code: "ru",
    ...place,
  }
  const methodData =
    d.kind === "pickup" ? {}
      : d.kind === "pochta" ? { postal_code: d.postal_code }
        : { city_code: d.city_code, city: clean(d.city, 100), pvz_code: d.pvz_code ?? null, pvz_address: d.pvz_address ? clean(d.pvz_address) : null }

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

    const { shipping_options } = await storeFetch<{ shipping_options: { id: string; type?: { code?: string } }[] }>(
      `/store/shipping-options?cart_id=${cart.id}`
    )
    const option = shipping_options.find((o) => o.type?.code === d.kind)
    if (!option) throw new Error("Способ получения недоступен")
    await cartRequest(`/store/carts/${cart.id}/shipping-methods`, "POST", { option_id: option.id, data: methodData })

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
      : /СДЭК|Почта|город|пункт|индекс/i.test(msg)
        ? "Не получилось рассчитать доставку. Проверьте адрес или выберите другой способ."
        : "Не получилось оформить заказ. Попробуйте ещё раз или позвоните нам."
    return NextResponse.json({ error: human }, { status: 409 })
  }
}
