import type { Metadata } from "next"

import { CheckoutForm } from "@/components/checkout-form"
import { NOINDEX } from "@/lib/seo"

export const metadata: Metadata = { title: "Оформление заказа — LAFLAMME", ...NOINDEX }

export default function CheckoutPage() {
  return <CheckoutForm />
}

export const instant = false
