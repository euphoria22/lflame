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
  // Нажали «Выберите размер» без размера — сетка размеров коротко подсвечивается
  const [nudge, setNudge] = useState(false)
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
  const lastOnes = allSingles ? [] : availableSizes.filter((v) => v.available === 1)
  const anyOut = variants.some((v) => v.available <= 0)
  // Кнопка ждёт выбора размера — светлая, чтобы не выглядеть активной
  const needSize = anyAvailable && !chosen && !onlyOneSize

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
      setNudge(true)
      setTimeout(() => setNudge(false), 700)
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
      className={`h-12 w-full rounded-full text-[14px] transition-colors disabled:bg-surface-2 disabled:text-muted aria-busy:opacity-70 ${needSize ? "bg-surface-2 text-muted" : "bg-foreground text-background hover:opacity-85"}`}>
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
                <button key={v.id} type="button" aria-pressed={on}
                  title={out ? "Нет в наличии — сообщим, когда появится" : v.available === 1 && !allSingles ? "Последний экземпляр" : undefined}
                  aria-label={out ? `${v.size} — нет в наличии, сообщить о поступлении` : v.available === 1 && !allSingles ? `${v.size} — последний экземпляр` : undefined}
                  onClick={() => { setSelected(v.id); setMessage(null) }}
                  className={`relative flex h-12 items-center justify-center rounded-xl border text-[13px] transition-colors duration-300 ${on ? (out ? "border-foreground bg-surface text-muted" : "border-foreground bg-foreground text-background") : out ? "border-line text-subtle hover:border-muted" : nudge ? "border-foreground" : "border-line hover:border-foreground"}`}>
                  {v.size}
                  {/* Последний экземпляр — точка; закончился — колокольчик (нажать — подписка на поступление) */}
                  {v.available === 1 && !allSingles && <span aria-hidden className="absolute right-2 top-2 size-1.5 rounded-full bg-sale" />}
                  {out && <BellIcon className="absolute right-1.5 top-1.5 size-3 opacity-70" />}
                </button>
              )
            })}
          </div>
          {allSingles && <p className="mt-2 text-[12px] text-muted">Каждый размер — в единственном экземпляре</p>}
          {lastOnes.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-sale" />
              {chosen && chosen.available === 1 ? `Остался последний — ${chosen.size}` : `Последний экземпляр: ${lastOnes.map((v) => v.size).join(", ")}`}
            </p>
          )}
          {anyOut && anyAvailable && !restock && (
            <p className="mt-1 text-[12px] text-muted">Нет размера? Нажмите на него — сообщим о поступлении</p>
          )}
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

function BellIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11Z" strokeLinejoin="round" />
      <path d="M6.5 14a1.6 1.6 0 0 0 3 0" strokeLinecap="round" />
    </svg>
  )
}
