import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Card, StatusBadge } from "@/components/account-parts"
import { getAccount, orderDate } from "@/lib/account"
import { formatPrice, plural } from "@/lib/format"
import { routes } from "@/lib/routes"
import { NOINDEX } from "@/lib/seo"
import { pageTitle } from "@/lib/site"

export const instant = false
export const metadata: Metadata = { title: pageTitle("Заказ"), ...NOINDEX }

const PAY: Record<string, string> = { tbank: "Онлайн: карта, СБП, T-Pay", split: "Частями: Яндекс Сплит", manual: "Предоплата по ссылке", cod: "При получении" }

/** Страница заказа: товары, итог, оплата, доставка и получатель, трек-номер. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { orders } = await getAccount()
  const o = orders.find((x) => x.id === id)
  if (!o) notFound()
  const count = o.items.reduce((s, i) => s + i.quantity, 0)
  const row = (k: string, v: React.ReactNode, strong = false) => (
    <div className="flex justify-between gap-4 text-[14px]"><span className="text-muted">{k}</span><span className={strong ? "font-medium" : ""}>{v}</span></div>
  )
  return (
    <div>
      <Link href="/account/orders" className="text-[13px] text-muted underline underline-offset-4 hover:text-foreground">← Ко всем заказам</Link>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="flex items-start justify-between gap-4 rounded-[24px] border border-line bg-background p-5 md:p-8">
            <div><h1 className="text-[24px] tracking-tight md:text-[30px]">Заказ № {o.number}</h1><p className="mt-1 text-[13px] text-muted">{orderDate(o.created_at)}</p></div>
            <StatusBadge s={o.status} />
          </section>
          {o.tracking && (
            <section className="rounded-[24px] bg-foreground p-5 text-background md:p-8">
              <p className="text-[13px] opacity-70">Трек-номер</p>
              <p className="mt-1 text-[20px] tracking-wide">{o.tracking.number}</p>
              {o.tracking.url && <a href={o.tracking.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] underline underline-offset-4">Отследить посылку →</a>}
            </section>
          )}
          <Card title={`Товары (${count})`}>
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3">
                  <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="64px" className="blend object-contain" />}</span>
                  <span className="min-w-0 flex-1 text-[14px]">
                    {i.handle ? <Link href={routes.product(i.handle)} className="hover:underline">{i.title}</Link> : i.title}
                    <span className="block text-[12px] text-muted">Размер {i.size} · {i.quantity} шт.</span>
                  </span>
                  <span className="text-right text-[14px]">
                    {formatPrice(i.price * i.quantity)}
                    {i.compare_at && i.compare_at > i.price && <s className="block text-[12px] text-muted">{formatPrice(i.compare_at * i.quantity)}</s>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Доставка и получатель">
            <dl className="grid gap-4 text-[14px] sm:grid-cols-2">
              <div><dt className="text-[12px] text-muted">Способ доставки</dt><dd className="mt-1">{o.delivery || "—"}</dd></div>
              <div><dt className="text-[12px] text-muted">Адрес</dt><dd className="mt-1">{o.address || (o.delivery.startsWith("Самовывоз") ? "Омск, ул. Партизанская, 5а/8" : "—")}</dd></div>
              <div><dt className="text-[12px] text-muted">Получатель</dt><dd className="mt-1">{o.recipient.name || "—"}</dd></div>
              <div><dt className="text-[12px] text-muted">Телефон</dt><dd className="mt-1">{o.recipient.phone || "—"}</dd></div>
              <div><dt className="text-[12px] text-muted">E-mail</dt><dd className="mt-1 break-words">{o.recipient.email || "—"}</dd></div>
            </dl>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Итого">
            <div className="space-y-2.5">
              {row(`${count} ${plural(count, ["товар", "товара", "товаров"])}`, formatPrice(o.goods || o.total - o.shipping_total))}
              {!!o.discount && row(o.promo_code ? `Промокод ${o.promo_code}` : "Скидка", <span className="text-sale">−{formatPrice(o.discount)}</span>)}
              {row("Доставка", o.shipping_total ? formatPrice(o.shipping_total) : "Бесплатно")}
            </div>
            <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5"><span className="text-[16px]">Итого</span><span className="text-[24px] tracking-tight">{formatPrice(o.total)}</span></div>
          </Card>
          <Card title="Оплата">
            <div className="space-y-2.5">
              {row("Способ оплаты", PAY[o.payment_method ?? ""] ?? "—")}
              {row("Статус оплаты", o.status.code === "canceled" ? "—" : o.paid ? "Оплачено" : "Ожидает оплаты", true)}
            </div>
            {!o.paid && o.payment_method === "manual" && o.status.code !== "canceled" && <p className="mt-4 text-[12px] leading-relaxed text-muted">Мы подтвердим наличие и пришлём ссылку на оплату. Заказ отправим после оплаты.</p>}
          </Card>
        </div>
      </div>
    </div>
  )
}
