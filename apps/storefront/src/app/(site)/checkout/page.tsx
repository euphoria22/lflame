import type { Metadata } from "next"

import { CheckoutForm } from "@/components/checkout-form"
import { NOINDEX } from "@/lib/seo"
import { storeFetch } from "@/lib/store-api"

export const metadata: Metadata = { title: "Оформление заказа — LAFLAMME", ...NOINDEX }

type Options = { online_payment: boolean; free_shipping_from: number }

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  // Сначала параметры запроса: страница рендерится только по запросу, не при сборке
  const { payment } = await searchParams
  const options = await storeFetch<Options>("/store/checkout/options").catch(() => ({ online_payment: false, free_shipping_from: 0 }))
  const notice = payment === "failed" ? "Оплата не прошла. Попробуйте ещё раз или выберите оплату при получении."
    : payment === "pending" ? "Мы ещё не получили подтверждение оплаты. Если деньги списались — заказ появится в течение нескольких минут, мы позвоним. Если нет — попробуйте ещё раз."
      : null
  return <CheckoutForm onlinePayment={options.online_payment} notice={notice} />
}

export const instant = false
