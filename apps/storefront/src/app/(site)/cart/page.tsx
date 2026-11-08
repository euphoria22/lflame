import type { Metadata } from "next"

import { CartPageView } from "@/components/cart-page-view"
import { NOINDEX } from "@/lib/seo"

export const metadata: Metadata = { title: "Корзина — LAFLAMME", ...NOINDEX }

export default function CartPage() {
  return <CartPageView />
}

export const instant = false
