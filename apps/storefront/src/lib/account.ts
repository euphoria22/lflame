import "server-only"
import { redirect } from "next/navigation"
import { cache } from "react"

import { getAuthToken, storeFetch } from "./store-api"
import type { AccountCustomer, AccountOrder, LoyaltyStatus } from "./account-types"

export type { AccountCustomer, AccountItem, AccountOrder, LoyaltyStatus, Tier } from "./account-types"

/** Данные кабинета одним запросом на страницу (cache — общий для макета и страницы). Без входа — на страницу входа. */
export const getAccount = cache(async () => {
  const token = await getAuthToken()
  if (!token) redirect("/account/login")
  const [data, loyalty] = await Promise.all([
    storeFetch<{ customer: AccountCustomer; orders: AccountOrder[] }>("/store/account/me/orders", { token }).catch(() => null),
    storeFetch<{ loyalty: LoyaltyStatus }>("/store/account/me/loyalty", { token }).then((d) => d.loyalty).catch(() => null),
  ])
  // Токен истёк или недействителен — заново ко входу
  if (!data) redirect("/account/login")
  return { customer: data.customer, orders: data.orders, loyalty }
})

export { orderDate, STATUS_STYLE } from "./account-status"
