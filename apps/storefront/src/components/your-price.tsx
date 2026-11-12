"use client"

import { useEffect, useState } from "react"

import { formatPrice } from "@/lib/format"

type MyDiscount = { pct: number; level?: string; excluded_brands?: string[] }

// Скидка запрашивается один раз на вкладку и общая для всех карточек
let req: Promise<MyDiscount> | null = null
const load = () => (req ??= fetch("/api/account/discount").then((r) => r.json()).catch(() => ({ pct: 0 })))

/** После входа или выхода скидку нужно запросить заново. */
export function resetMyDiscount() {
  req = null
}

/** Цена со скидкой уровня — то же правило, что в корзине: от текущей цены, суммируется с постоянной уценкой. */
export function loyaltyPrice(price: number, pct: number): number {
  return pct ? Math.round(price * (1 - pct / 100)) : price
}

/**
 * «Ваша цена» для вошедшего участника программы LAFLAMME (ТЗ, п. 6.7) — на карточках каталога и странице товара.
 * Страницы каталога общие для всех и кэшируются, поэтому цена считается в браузере; в корзине её считает сервер.
 */
export function YourPrice({ price, brand, noLoyalty, size = "sm" }: {
  price: number
  brand?: string | null
  noLoyalty?: boolean
  size?: "sm" | "lg"
}) {
  const [d, setD] = useState<MyDiscount | null>(null)
  useEffect(() => {
    let alive = true
    load().then((v) => { if (alive) setD(v) })
    return () => { alive = false }
  }, [])
  if (!d?.pct) return null
  // Товар без скидок Club: говорим об этом только тем, у кого скидка есть (остальным строка ни к чему)
  if (noLoyalty) return size === "lg" ? <p className="mt-2 text-[12px] text-muted">Скидка {d.level} −{d.pct}% на этот товар не действует</p> : null
  if (brand && d.excluded_brands?.some((b) => b.toLowerCase() === brand.toLowerCase())) return null
  const mine = loyaltyPrice(price, d.pct)
  if (mine >= price) return null
  return size === "lg" ? (
    <p className="mt-2 text-[15px]">
      <span className="text-sale">Ваша цена {formatPrice(mine)}</span>
      <span className="ml-2 text-[13px] text-muted">{d.level} −{d.pct}%</span>
    </p>
  ) : (
    <span className="block text-[13px] text-sale">Ваша цена {formatPrice(mine)}</span>
  )
}
