import type { Metadata } from "next"

import { CartPageView } from "@/components/cart-page-view"
import { NOINDEX } from "@/lib/seo"
import { pageTitle } from "@/lib/site"

export const metadata: Metadata = { title: pageTitle("Корзина"), ...NOINDEX }

export default function CartPage() {
  return <CartPageView />
}

export const instant = false
