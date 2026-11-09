"use client"

import { useEffect, useState } from "react"

import { formatPrice } from "@/lib/format"

// Один запрос настроек на вкладку; порог меняется в админке («Доставка и оплата»)
let pending: Promise<number> | null = null
function loadThreshold(): Promise<number> {
  pending ??= fetch("/api/checkout/options")
    .then((r) => r.json())
    .then((d: { free_shipping_from?: number }) => Number(d.free_shipping_from ?? 0))
    .catch(() => 0)
  return pending
}

/** Подсказка в корзине: сколько осталось до бесплатной доставки. */
export function FreeShippingNote({ total }: { total: number }) {
  const [from, setFrom] = useState<number | null>(null)
  useEffect(() => { loadThreshold().then(setFrom) }, [])

  if (!from) return <p className="mt-1 text-[12px] text-muted">Доставка рассчитывается при оформлении</p>
  const left = from - total
  const pct = Math.min(100, Math.round((total / from) * 100))
  return (
    <div className="mt-2">
      <p className="text-[12px] text-muted">
        {left > 0 ? <>До бесплатной доставки осталось <span className="text-foreground">{formatPrice(left)}</span></> : "Бесплатная доставка до пункта СДЭК и Почтой России"}
      </p>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
