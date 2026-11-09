import type { Metadata } from "next"

import { Card, ClubCard, OrderRow } from "@/components/account-parts"
import { FavoritesPreview, ProfileCard } from "@/components/account-profile"
import { LogoutButton } from "@/components/account-nav"
import { getAccount } from "@/lib/account"
import { routes } from "@/lib/routes"
import { NOINDEX } from "@/lib/seo"
import { pageTitle } from "@/lib/site"
import Link from "next/link"

export const instant = false
export const metadata: Metadata = { title: pageTitle("Личный кабинет"), ...NOINDEX }

/** Профиль: данные, последние заказы, Laflamme Club, избранное. */
export default async function AccountPage() {
  const { customer, orders, loyalty } = await getAccount()
  return (
    <div className="space-y-4">
      <h1 className="text-[28px] tracking-tight md:text-[40px]">{customer.first_name ? `Здравствуйте, ${customer.first_name}` : "Личный кабинет"}</h1>
      <ProfileCard customer={customer} />
      <Card title="Последние заказы" action={orders.length > 3 ? { label: "Все заказы", href: "/account/orders" } : undefined}>
        {orders.length ? (
          <div className="divide-y divide-line">{orders.slice(0, 3).map((o) => <OrderRow key={o.id} o={o} />)}</div>
        ) : (
          <div className="py-4 text-[14px] text-muted">
            Заказов пока нет. <Link href={routes.newIn()} className="text-foreground underline underline-offset-4">Смотреть новинки</Link>
          </div>
        )}
      </Card>
      {loyalty?.enabled && <ClubCard s={loyalty} compact />}
      <FavoritesPreview />
      <LogoutButton className="w-full rounded-full border border-line py-3 text-[14px] hover:border-foreground md:hidden" />
    </div>
  )
}
