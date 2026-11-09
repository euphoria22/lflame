"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { formatPrice } from "@/lib/format"
import { routes } from "@/lib/routes"
import { resetCartProgress } from "./cart-progress"
import { LoyaltyCard, LoyaltyStatus } from "./loyalty-card"

export type AccountOrder = {
  id: string
  number: number
  created_at: string
  status: { code: string; label: string }
  total: number
  shipping_total: number
  paid_online: boolean
  delivery: string
  address: string
  tracking: { number: string; url: string } | null
  items: { id: string; title: string; size: string; quantity: number; price: number; thumbnail: string | null; handle: string | null }[]
}
export type AccountCustomer = { email: string; first_name: string | null; last_name: string | null; phone: string | null }

const STATUS_COLOR: Record<string, string> = {
  new: "bg-surface", packed: "bg-surface", shipped: "bg-foreground text-background", delivered: "bg-[#e6f4ea] text-[#1e6b34]", canceled: "bg-[#fbe9e9] text-sale",
}

const date = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })

/** Личный кабинет (ТЗ, п. 6.5): заказы со статусами и треками, профиль. */
export function AccountView({ customer, orders, loyalty }: { customer: AccountCustomer; orders: AccountOrder[]; loyalty: LoyaltyStatus | null }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(orders[0]?.id ?? null)

  const logout = async () => {
    await fetch("/api/account/logout", { method: "POST" })
    resetCartProgress()
    router.replace("/")
    router.refresh()
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 pt-8 md:grid-cols-[1fr_320px] md:px-8">
      <div>
        <h1 className="text-[28px] tracking-tight md:text-[40px]">{customer.first_name ? `Здравствуйте, ${customer.first_name}` : "Личный кабинет"}</h1>
        <h2 className="mb-4 mt-10 text-[17px]">Мои заказы</h2>
        {!orders.length ? (
          <div className="rounded-[22px] bg-surface px-6 py-10 text-center">
            <p className="text-[15px]">Заказов пока нет</p>
            <Link href={routes.newIn()} className="mt-4 inline-block rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Смотреть новинки</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const on = open === o.id
              return (
                <li key={o.id} className="overflow-hidden rounded-[18px] border border-line">
                  <button type="button" onClick={() => setOpen(on ? null : o.id)} aria-expanded={on}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-surface/60">
                    <span className="text-[15px]">Заказ № {o.number}</span>
                    <span className="text-[13px] text-muted">{date(o.created_at)}</span>
                    <span className={`rounded-full px-3 py-1 text-[12px] ${STATUS_COLOR[o.status.code] ?? "bg-surface"}`}>{o.status.label}</span>
                    <span className="ml-auto text-[15px]">{formatPrice(o.total)}</span>
                  </button>
                  {on && (
                    <div className="border-t border-line px-5 py-4">
                      {o.tracking && (
                        <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-[13px]">
                          Трек-номер: <span className="font-medium">{o.tracking.number}</span>
                          {o.tracking.url && <> · <a href={o.tracking.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">отследить</a></>}
                        </p>
                      )}
                      <ul className="space-y-3">
                        {o.items.map((i) => (
                          <li key={i.id} className="flex gap-3 text-[13px]">
                            <span className="relative h-16 w-12 shrink-0 overflow-hidden bg-surface">
                              {i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="48px" className="blend object-contain" />}
                            </span>
                            <span className="flex-1">
                              {i.handle ? <Link href={routes.product(i.handle)} className="hover:underline">{i.title}</Link> : i.title}
                              <span className="block text-muted">{i.size} · {i.quantity} шт.</span>
                            </span>
                            <span>{formatPrice(i.price * i.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 space-y-1 border-t border-line pt-3 text-[13px] text-muted">
                        <p>{o.delivery}{o.address ? ` · ${o.address}` : ""}</p>
                        <p>Доставка: {o.shipping_total ? formatPrice(o.shipping_total) : "бесплатно"} · {o.paid_online ? "оплачено онлайн" : "оплата при получении"}</p>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <aside className="space-y-3 md:pt-[88px]">
        {loyalty && <LoyaltyCard s={loyalty} />}
        <Profile customer={customer} />
        <button type="button" onClick={logout} className="w-full rounded-full border border-line py-3 text-[14px] hover:border-foreground">Выйти</button>
      </aside>
    </div>
  )
}

function Profile({ customer }: { customer: AccountCustomer }) {
  const [v, setV] = useState({ first_name: customer.first_name ?? "", last_name: customer.last_name ?? "", phone: customer.phone ?? "" })
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const field = "h-11 w-full rounded-xl border border-line bg-background px-3 text-[14px] outline-none focus:border-foreground"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setState("saving")
    const r = await fetch("/api/account/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) })
    setState(r.ok ? "saved" : "error")
  }

  return (
    <form onSubmit={save} className="space-y-2 rounded-[22px] border border-line p-6">
      <p className="text-[15px]">Профиль</p>
      <p className="pb-1 text-[13px] text-muted">{customer.email}</p>
      <input className={field} placeholder="Имя" autoComplete="given-name" value={v.first_name} onChange={(e) => { setV({ ...v, first_name: e.target.value }); setState("idle") }} />
      <input className={field} placeholder="Фамилия" autoComplete="family-name" value={v.last_name} onChange={(e) => { setV({ ...v, last_name: e.target.value }); setState("idle") }} />
      <input className={field} placeholder="Телефон" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => { setV({ ...v, phone: e.target.value }); setState("idle") }} />
      <button disabled={state === "saving"} className="h-11 w-full rounded-full bg-foreground text-[14px] text-background disabled:opacity-60">
        {state === "saving" ? "Сохраняем…" : state === "saved" ? "Сохранено" : "Сохранить"}
      </button>
      {state === "error" && <p className="text-[12px] text-sale">Не сохранилось. Попробуйте ещё раз.</p>}
      <p className="pt-1 text-[11px] leading-relaxed text-muted">Имя и телефон подставятся при оформлении заказа.</p>
    </form>
  )
}
