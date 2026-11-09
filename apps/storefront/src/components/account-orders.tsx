"use client"

import { useState } from "react"

import type { AccountOrder } from "@/lib/account-types"
import { OrderRow } from "./account-parts"

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "done", label: "Выполнены" },
  { key: "active", label: "В обработке" },
  { key: "canceled", label: "Отменены" },
] as const

/** Список заказов с фильтром по статусу. */
export function OrdersList({ orders }: { orders: AccountOrder[] }) {
  const [f, setF] = useState<(typeof FILTERS)[number]["key"]>("all")
  const shown = f === "all" ? orders : orders.filter((o) => o.status.group === f)
  return (
    <>
      <div className="chips-rail -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map((x) => (
          <button key={x.key} type="button" onClick={() => setF(x.key)} aria-pressed={f === x.key}
            className={`shrink-0 rounded-full border px-4 py-2 text-[13px] ${f === x.key ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground"}`}>
            {x.label}
          </button>
        ))}
      </div>
      <section className="mt-4 rounded-[24px] border border-line bg-background px-5 md:px-8">
        {shown.length ? (
          <div className="divide-y divide-line">{shown.map((o) => <OrderRow key={o.id} o={o} />)}</div>
        ) : (
          <p className="py-8 text-[14px] text-muted">{orders.length ? "Нет заказов с таким статусом." : "Заказов пока нет."}</p>
        )}
      </section>
    </>
  )
}
