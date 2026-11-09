"use client"

import { useEffect, useRef, useState } from "react"

import { formatPrice } from "@/lib/format"
import type { SizeChart } from "@/lib/blog"
import type { CatalogVariant } from "@/lib/types"
import { useCart } from "./cart-context"
import { RestockForm } from "./restock-form"
import { SizeGuide } from "./size-guide"

/**
 * Выбор размера и кнопка «В корзину» (ТЗ, п. 6.3).
 * На телефоне снизу закреплена стеклянная панель с ценой и кнопкой.
 */
export function BuyBox({ variants, price, preorder = false, sizeChart = null }: { variants: CatalogVariant[]; price: number; preorder?: boolean; sizeChart?: SizeChart | null }) {
  const [selected, setSelected] = useState<string | null>(() => {
    const available = variants.filter((v) => v.available > 0)
    return available.length === 1 && variants.length === 1 ? available[0].id : null
  })
  const [message, setMessage] = useState<string | null>(null)
  const [barVisible, setBarVisible] = useState(false)
  const cart = useCart()
  const box = useRef<HTMLDivElement>(null)

  const anyAvailable = variants.some((v) => v.available > 0)
  const availableSizes = variants.filter((v) => v.available > 0)
  // Пометка «последний» имеет смысл, только если часть размеров есть в большем количестве
  const allSingles = availableSizes.length > 1 && availableSizes.every((v) => v.available === 1)
  const onlyOneSize = variants.length === 1 && variants[0].size === "One Size"
  const picked = variants.find((v) => v.id === selected)
  const chosen = picked && picked.available > 0 ? picked : undefined
  const restock = picked && picked.available <= 0 ? picked : onlyOneSize && !anyAvailable ? variants[0] : undefined

  // Размер из ссылки ?size=… (кнопки размеров в карточке каталога)
  useEffect(() => {
    const size = new URLSearchParams(window.location.search).get("size")
    const v = size ? variants.find((x) => x.size === size && x.available > 0) : null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- адрес доступен только в браузере
    if (v) setSelected(v.id)
  }, [variants])

  // Панель на телефоне появляется, когда блок с кнопкой ушёл с экрана
  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setBarVisible(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const [adding, setAdding] = useState(false)
  const add = async () => {
    const target = chosen ?? (onlyOneSize ? variants[0] : undefined)
    if (!target) {
      setMessage("Выберите размер")
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setMessage(null)
    setAdding(true)
    const ok = await cart.add(target.id)
    setAdding(false)
    if (!ok) setMessage(cart.error ?? "Не получилось добавить в корзину")
  }

  const button = (
    // Пока товар добавляется, кнопка остаётся чёрной и пишет «Добавляем…» — без резкого серого мигания
    <button type="button" onClick={() => { if (!adding && !cart.busy) add() }} disabled={!anyAvailable} aria-busy={adding}
      className="h-12 w-full rounded-full bg-foreground text-[14px] text-background transition-opacity hover:opacity-85 disabled:bg-surface-2 disabled:text-muted aria-busy:opacity-70">
      {!anyAvailable ? "Нет в наличии" : adding ? "Добавляем…" : chosen || onlyOneSize ? (preorder ? "Оформить предзаказ" : "В корзину") : "Выберите размер"}
    </button>
  )

  return (
    <div ref={box}>
      {!onlyOneSize && (
        <fieldset>
          <legend className="mb-3 flex w-full items-center justify-between text-[13px]">
            <span>Размер{picked ? `: ${picked.size}` : ""}</span>
            {sizeChart && <SizeGuide chart={sizeChart} />}
          </legend>
          <div className="grid grid-cols-4 gap-1.5">
            {variants.map((v) => {
              const out = v.available <= 0
              const on = v.id === selected
              return (
                // Закончившийся размер можно выбрать — появится «Сообщить о поступлении»
                <button key={v.id} type="button" aria-pressed={on} title={out ? "Нет в наличии — сообщим о поступлении" : undefined}
                  onClick={() => { setSelected(v.id); setMessage(null) }}
                  className={`relative flex h-12 flex-col items-center justify-center rounded-xl border text-[13px] transition-colors ${on ? (out ? "border-foreground bg-surface text-muted line-through" : "border-foreground bg-foreground text-background") : out ? "border-line text-subtle line-through hover:border-muted" : "border-line hover:border-foreground"}`}>
                  {v.size}
                  {v.available === 1 && !allSingles && <span className={`eyebrow text-[9px] ${on ? "text-background/70" : "text-muted"}`}>последний</span>}
                </button>
              )
            })}
          </div>
          {allSingles && <p className="mt-2 text-[12px] text-muted">Каждый размер — в единственном экземпляре</p>}
        </fieldset>
      )}
      {/* Выбран закончившийся размер (или единственный размер закончился) — подписка вместо кнопки */}
      {restock ? <div className="mt-5"><RestockForm variantId={restock.id} size={restock.size} /></div> : <div className="mt-5">{button}</div>}
      {!anyAvailable && !restock && <p className="mt-3 text-[13px] text-muted">Выберите размер — сообщим на почту, когда он появится.</p>}
      {message && <p className="mt-3 text-[13px] text-muted" role="status">{message}</p>}

      <div className={`glass fixed inset-x-2 bottom-2 z-40 flex items-center gap-3 rounded-full p-1.5 pl-5 transition-all duration-300 md:hidden ${barVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
        <span className="flex-1 text-[15px]">{formatPrice(chosen?.price ?? price)}</span>
        <div className="w-44">{button}</div>
      </div>
    </div>
  )
}
