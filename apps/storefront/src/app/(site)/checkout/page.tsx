import type { Metadata } from "next"
import { connection } from "next/server"

import { CheckoutForm } from "@/components/checkout-form"
import { NOINDEX } from "@/lib/seo"
import { currentCustomer, storeFetch } from "@/lib/store-api"

export const metadata: Metadata = { title: "Оформление заказа — LAFLAMME", ...NOINDEX }

type Options = { online_payment: boolean; manual_payment: boolean; cod_methods: string[]; free_shipping_from: number }

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  // Страница рендерится только по запросу: настройки из админки должны быть свежими
  await connection()
  const { payment } = await searchParams
  const [options, customer] = await Promise.all([
    storeFetch<Options>("/store/checkout/options").catch(() => ({ online_payment: false, manual_payment: true, cod_methods: [], free_shipping_from: 0 })),
    currentCustomer(),
  ])
  const notice = payment === "failed" ? "Оплата не прошла. Попробуйте ещё раз или выберите оплату при получении."
    : payment === "pending" ? "Мы ещё не получили подтверждение оплаты. Если деньги списались — заказ появится в течение нескольких минут, мы позвоним. Если нет — попробуйте ещё раз."
      : null
  const defaults = customer
    ? { email: customer.email, first_name: customer.first_name ?? "", last_name: customer.last_name ?? "", phone: customer.phone ?? "" }
    : undefined
  return <CheckoutForm options={options} notice={notice} defaults={defaults} />
}

export const instant = false
