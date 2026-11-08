"use client"

import { useEffect, useState } from "react"

import type { CatalogItem } from "@/lib/types"
import { ProductCard } from "./product-card"

const KEY = "lf:recent"

/** «Вы смотрели» (ТЗ, п. 6.3): хранится только в браузере покупателя. */
export function RecentlyViewed({ current }: { current: CatalogItem }) {
  const [items, setItems] = useState<CatalogItem[]>([])

  useEffect(() => {
    let list: CatalogItem[] = []
    try {
      list = JSON.parse(localStorage.getItem(KEY) || "[]")
    } catch {
      list = []
    }
    const others = list.filter((i) => i.handle !== current.handle)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- данные доступны только в браузере
    setItems(others.slice(0, 4))
    try {
      localStorage.setItem(KEY, JSON.stringify([current, ...others].slice(0, 12)))
    } catch {
      // приватный режим или переполнение — просто не запоминаем
    }
  }, [current])

  if (!items.length) return null
  return (
    <section className="mt-20">
      <h2 className="mb-5 px-4 text-[20px] tracking-tight md:px-8 md:text-[24px]">Вы смотрели</h2>
      <ul className="rail grid-lines grid auto-cols-[46%] grid-flow-col overflow-x-auto md:auto-cols-auto md:grid-flow-row md:grid-cols-4">
        {items.map((item) => (
          <li key={item.id} className="md:[&:nth-child(4n)]:border-r-0"><ProductCard item={item} sizes="(min-width: 768px) 25vw, 46vw" /></li>
        ))}
      </ul>
    </section>
  )
}
