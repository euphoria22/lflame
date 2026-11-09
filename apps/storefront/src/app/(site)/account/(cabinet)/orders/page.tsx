import type { Metadata } from "next"

import { OrdersList } from "@/components/account-orders"
import { getAccount } from "@/lib/account"
import { NOINDEX } from "@/lib/seo"
import { pageTitle } from "@/lib/site"

export const instant = false
export const metadata: Metadata = { title: pageTitle("Мои заказы"), ...NOINDEX }

export default async function OrdersPage() {
  const { orders } = await getAccount()
  return (
    <div>
      <h1 className="mb-5 text-[28px] tracking-tight md:text-[40px]">Мои заказы</h1>
      <OrdersList orders={orders} />
    </div>
  )
}
