"use client"

import { useState } from "react"

import { useCart } from "./cart-context"

/** Кнопки размеров на карточке каталога: нажатие сразу добавляет размер в корзину. */
export function QuickSizes({ sizes }: { sizes: { size: string; variant_id?: string }[] }) {
  const { add } = useCart()
  const [adding, setAdding] = useState<string | null>(null)
  return (
    <ul className="glass absolute inset-x-3 bottom-3 z-10 hidden translate-y-2 flex-wrap justify-center gap-1 rounded-[22px] p-1.5 opacity-0 transition-all duration-200 md:flex md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
      {sizes.map((s) => (
        <li key={s.size}>
          <button type="button" disabled={!s.variant_id || adding !== null} aria-label={`Добавить размер ${s.size} в корзину`}
            onClick={async () => { if (!s.variant_id) return; setAdding(s.size); await add(s.variant_id); setAdding(null) }}
            className="block min-w-10 rounded-full px-2.5 py-1.5 text-center text-[12px] transition-colors hover:bg-foreground hover:text-background disabled:opacity-60">
            {adding === s.size ? "…" : s.size}
          </button>
        </li>
      ))}
    </ul>
  )
}
