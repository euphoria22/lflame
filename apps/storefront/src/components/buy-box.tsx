"use client"

import { useEffect, useRef, useState } from "react"

import { formatPrice } from "@/lib/format"
import type { CatalogVariant } from "@/lib/types"

/**
 * Выбор размера и кнопка «В корзину» (ТЗ, п. 6.3). Корзина подключается на этапе 4,
 * пока кнопка запоминает выбор и сообщает об этом.
 * На телефоне снизу закреплена стеклянная панель с ценой и кнопкой.
 */
export function BuyBox({ variants, price }: { variants: CatalogVariant[]; price: number }) {
  const [selected, setSelected] = useState<string | null>(() => {
    const available = variants.filter((v) => v.available > 0)
    return available.length === 1 && variants.length === 1 ? available[0].id : null
  })
  const [message, setMessage] = useState<string | null>(null)
  const [barVisible, setBarVisible] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const anyAvailable = variants.some((v) => v.available > 0)
  const onlyOneSize = variants.length === 1 && variants[0].size === "One Size"
  const chosen = variants.find((v) => v.id === selected)

  // Панель на телефоне появляется, когда блок с кнопкой ушёл с экрана
  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setBarVisible(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const add = () => {
    if (!chosen) {
      setMessage("Выберите размер")
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setMessage(`Размер ${chosen.size} выбран. Корзина появится на следующем этапе разработки.`)
  }

  const button = (
    <button type="button" onClick={add} disabled={!anyAvailable}
      className="h-12 w-full rounded-full bg-foreground text-[14px] text-background transition-opacity hover:opacity-85 disabled:bg-surface-2 disabled:text-muted">
      {!anyAvailable ? "Нет в наличии" : chosen || onlyOneSize ? "В корзину" : "Выберите размер"}
    </button>
  )

  return (
    <div ref={box}>
      {!onlyOneSize && (
        <fieldset>
          <legend className="mb-3 flex w-full items-center justify-between text-[13px]">
            <span>Размер{chosen ? `: ${chosen.size}` : ""}</span>
          </legend>
          <div className="grid grid-cols-4 gap-1.5">
            {variants.map((v) => {
              const out = v.available <= 0
              const on = v.id === selected
              return (
                <button key={v.id} type="button" disabled={out} aria-pressed={on}
                  onClick={() => { setSelected(v.id); setMessage(null) }}
                  className={`relative flex h-12 flex-col items-center justify-center rounded-xl border text-[13px] transition-colors ${on ? "border-foreground bg-foreground text-background" : out ? "cursor-not-allowed border-line text-subtle line-through" : "border-line hover:border-foreground"}`}>
                  {v.size}
                  {v.available === 1 && <span className={`eyebrow text-[9px] ${on ? "text-background/70" : "text-muted"}`}>последний</span>}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
      <div className="mt-5">{button}</div>
      {message && <p className="mt-3 text-[13px] text-muted" role="status">{message}</p>}

      <div className={`glass fixed inset-x-2 bottom-2 z-40 flex items-center gap-3 rounded-full p-1.5 pl-5 transition-all duration-300 md:hidden ${barVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
        <span className="flex-1 text-[15px]">{formatPrice(chosen?.price ?? price)}</span>
        <div className="w-44">{button}</div>
      </div>
    </div>
  )
}
