import { NextRequest, NextResponse } from "next/server"

import { CheckoutInput, normalizePhone, PaymentMethod, validateCheckout } from "@/lib/checkout"
import { DeliveryChoice, PICKUP, validateDelivery } from "@/lib/delivery"
import { SITE_URL } from "@/lib/site"
import { cartRequest, getAuthToken, retrieveCart, setCartId, storeFetch, syncLoyalty } from "@/lib/store-api"

/**
 * Оформление заказа (ТЗ, п. 6.4): контакты → способ получения → оплата → заказ.
 * Получение: самовывоз в Омске, СДЭК (пункт выдачи, курьер), Почта России.
 * Оплата: при получении (pp_system_default) — заказ создаётся сразу;
 * онлайн через Т-Кассу (pp_tbank_tbank) — возвращаем ссылку на платёжную форму,
 * заказ создаётся после оплаты (/checkout/paid или уведомление Т-Кассы в Medusa).
 */
export async function POST(req: NextRequest) {
  const input = (await req.json().catch(() => ({}))) as Partial<CheckoutInput> & { delivery?: Partial<DeliveryChoice>; payment?: PaymentMethod }
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

  // Способ оплаты проверяется по настройкам магазина (админка «Доставка и оплата»)
  const opts = await storeFetch<{ online_payment: boolean; manual_payment: boolean; cod_methods: string[] }>("/store/checkout/options")
    .catch(() => ({ online_payment: false, manual_payment: true, cod_methods: [] as string[] }))
  const payment = input.payment as PaymentMethod
  const allowed = (payment === "tbank" && opts.online_payment) || (payment === "manual" && opts.manual_payment)
    || (payment === "cod" && opts.cod_methods.includes(String(input.delivery?.kind)))
  if (!allowed) return NextResponse.json({ error: "Выберите способ оплаты" }, { status: 400 })
  const phone = normalizePhone(input.phone!)!
  const d = input.delivery as DeliveryChoice
  const clean = (s: string | undefined, n = 200) => (s ?? "").trim().slice(0, n)
  const place =
    d.kind === "pickup" ? { address_1: `Самовывоз: ${PICKUP.address}`, city: "Омск" }
      : d.kind === "omsk-courier" ? { address_1: clean(d.address), city: "Омск" }
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
    d.kind === "pickup" || d.kind === "omsk-courier" ? {}
      : d.kind === "pochta" ? { postal_code: d.postal_code }
        : { city_code: d.city_code, city: clean(d.city, 100), pvz_code: d.pvz_code ?? null, pvz_address: d.pvz_address ? clean(d.pvz_address) : null }

  try {
    // Вошедший покупатель — заказ попадёт в его кабинет
    const token = await getAuthToken()
    if (token) {
      await storeFetch(`/store/carts/${cart.id}/customer`, { method: "POST", token }).catch(() => null)
      // Пустые имя и телефон в профиле заполняем из заказа
      const me = await storeFetch<{ customer: { first_name: string | null; phone: string | null } }>("/store/account/me", { token }).catch(() => null)
      if (me && (!me.customer.first_name || !me.customer.phone)) {
        await storeFetch("/store/account/me", {
          method: "POST",
          token,
          body: { first_name: me.customer.first_name || address.first_name, last_name: address.last_name, phone: me.customer.phone || phone },
        }).catch(() => null)
      }
    }

    await cartRequest(`/store/carts/${cart.id}`, "POST", {
      email: input.email!.trim().toLowerCase(),
      shipping_address: address,
      billing_address: address,
      metadata: {
        comment: input.comment?.trim().slice(0, 1000) || null,
        // ТЗ, п. 6.4, 8.7: отдельное согласие на обработку ПД и на рассылки — с датой
        pd_consent_at: new Date().toISOString(),
        marketing_consent: Boolean(input.marketing),
        payment_method: payment,
      },
    })

    // Скидка уровня пересчитывается на сервере прямо перед заказом (ТЗ, п. 6.7)
    await syncLoyalty(cart.id)

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

    if (payment === "tbank") {
      // Чек 54-ФЗ: позиции заказа и доставка (используется, если касса подключена в Т-Кассе)
      const fresh = await retrieveCart()
      // Цена позиции — с учётом промокода (сумма строки / количество), копейки сводим к итогу корзины
      const receipt = [
        ...(fresh?.items ?? []).map((i) => ({ name: [i.product_title, i.variant_title].filter(Boolean).join(", "), price: Math.round((Number(i.total) / i.quantity) * 100) / 100, quantity: i.quantity })),
        ...(fresh && Number(fresh.shipping_total) > 0 ? [{ name: "Доставка", price: Number(fresh.shipping_total), quantity: 1, kind: "service" }] : []),
      ]
      const diff = Math.round((Number(fresh?.total ?? 0) - receipt.reduce((s, l) => s + l.price * l.quantity, 0)) * 100) / 100
      const fix = receipt.find((l) => l.quantity === 1)
      if (diff && fix) fix.price = Math.round((fix.price + diff) * 100) / 100
      const { payment_collection: pc } = await storeFetch<{ payment_collection: { payment_sessions?: { provider_id: string; data?: { PaymentURL?: string } }[] } }>(
        `/store/payment-collections/${payment_collection.id}/payment-sessions`,
        {
          method: "POST",
          body: {
            provider_id: "pp_tbank_tbank",
            data: {
              success_url: `${SITE_URL}/checkout/paid`,
              fail_url: `${SITE_URL}/checkout?payment=failed`,
              description: "Заказ в магазине Laflamme",
              email: input.email!.trim().toLowerCase(),
              phone,
              receipt,
            },
          },
        }
      )
      const url = pc.payment_sessions?.find((s) => s.provider_id === "pp_tbank_tbank")?.data?.PaymentURL
      if (!url) throw new Error("Т-Касса: нет ссылки на оплату")
      return NextResponse.json({ redirect: url })
    }

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
      : /Т-Касса|оплат/i.test(msg)
        ? "Онлайн-оплата сейчас недоступна. Выберите оплату при получении или попробуйте позже."
      : /СДЭК|Почта|город|пункт|индекс/i.test(msg)
        ? "Не получилось рассчитать доставку. Проверьте адрес или выберите другой способ."
        : "Не получилось оформить заказ. Попробуйте ещё раз или позвоните нам."
    return NextResponse.json({ error: human }, { status: 409 })
  }
}
