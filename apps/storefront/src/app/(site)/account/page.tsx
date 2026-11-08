import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { AccountCustomer, AccountOrder, AccountView } from "@/components/account-view"
import { NOINDEX } from "@/lib/seo"
import { getAuthToken, storeFetch } from "@/lib/store-api"

export const metadata: Metadata = { title: "Личный кабинет — LAFLAMME", ...NOINDEX }
export const instant = false

export default async function AccountPage() {
  await connection()
  const token = await getAuthToken()
  if (!token) redirect("/account/login")
  const data = await storeFetch<{ customer: AccountCustomer; orders: AccountOrder[] }>("/store/account/me/orders", { token }).catch(() => null)
  // Токен истёк или недействителен — заново ко входу
  if (!data) redirect("/account/login")
  return <AccountView customer={data.customer} orders={data.orders} />
}
