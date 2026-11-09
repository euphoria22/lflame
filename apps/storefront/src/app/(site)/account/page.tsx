import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { AccountCustomer, AccountOrder, AccountView } from "@/components/account-view"
import type { LoyaltyStatus } from "@/components/loyalty-card"
import { NOINDEX } from "@/lib/seo"
import { getAuthToken, storeFetch } from "@/lib/store-api"
import { pageTitle } from "@/lib/site"

export const metadata: Metadata = { title: pageTitle("Личный кабинет"), ...NOINDEX }
export const instant = false

export default async function AccountPage() {
  await connection()
  const token = await getAuthToken()
  if (!token) redirect("/account/login")
  const [data, loyalty] = await Promise.all([
    storeFetch<{ customer: AccountCustomer; orders: AccountOrder[] }>("/store/account/me/orders", { token }).catch(() => null),
    storeFetch<{ loyalty: LoyaltyStatus }>("/store/account/me/loyalty", { token }).then((d) => d.loyalty).catch(() => null),
  ])
  // Токен истёк или недействителен — заново ко входу
  if (!data) redirect("/account/login")
  return <AccountView customer={data.customer} orders={data.orders} loyalty={loyalty} />
}
