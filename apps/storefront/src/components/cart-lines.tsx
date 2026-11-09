"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

import { formatPrice } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { Cart } from "@/lib/cart-types"
import { useCart } from "./cart-context"
import { TrashIcon } from "./icons"

type Size = { size: string; in_stock: boolean; variant_id?: string }

/**
 * Позиции корзины: панель, страница корзины и оформление.
 * Размер меняется прямо здесь; «−» на последней штуке убирает товар (значок корзины).
 */
export function CartLines({ cart, onNavigate, compact = false }: { cart: Cart; onNavigate?: () => void; compact?: boolean }) {
  const { update, remove, changeSize, busy } = useCart()
  const [sizes, setSizes] = useState<Record<string, Size[]>>({})
  const handles = [...new Set(cart.lines.map((l) => l.handle).filter(Boolean))].sort().join(",")

  useEffect(() => {
    if (!handles) return
    let cancelled = false
    fetch(`/api/catalog/sizes?h=${encodeURIComponent(handles)}`)
      .then((r) => r.json())
      .then((d: { sizes: Record<string, Size[]> }) => { if (!cancelled) setSizes(d.sizes ?? {}) })
      .catch(() => null)
    return () => { cancelled = true }
  }, [handles])

  return (
    <ul className="divide-y divide-line">
      {cart.lines.map((l) => {
        // Только размеры в наличии (и текущий, даже если закончился)
        const options = ((l.handle && sizes[l.handle]) || []).filter((s) => s.variant_id && (s.in_stock || s.variant_id === l.variant_id))
        const canChange = options.length > 1
        return (
          <li key={l.id} className={`flex gap-4 ${compact ? "py-3" : "py-4"}`}>
            <Link href={l.handle ? routes.product(l.handle) : "#"} onClick={onNavigate}
              className={`relative shrink-0 overflow-hidden bg-surface ${compact ? "h-20 w-15" : "h-28 w-21"}`}>
              {l.thumbnail && <Image src={l.thumbnail} alt={l.title} fill sizes="84px" className="blend object-contain" />}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={l.handle ? routes.product(l.handle) : "#"} onClick={onNavigate} className="line-clamp-2 text-[13px] leading-snug">{l.title}</Link>
              <div className="mt-1 text-[12px] text-muted">
                {canChange ? (
                  <label className="inline-flex items-center gap-1">
                    Размер:
                    <select value={l.variant_id} disabled={busy} onChange={(e) => changeSize(l.id, e.target.value)} aria-label={`Размер: ${l.title}`}
                      className="w-24 cursor-pointer truncate rounded-full border border-line bg-background py-0.5 pl-2.5 pr-6 text-[12px] text-foreground outline-none hover:border-foreground focus:border-foreground">
                      {options.map((s) => (
                        <option key={s.variant_id} value={s.variant_id}>{s.size}</option>
                      ))}
                    </select>
                  </label>
                ) : <>Размер: {l.size}</>}
              </div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="flex items-center rounded-full border border-line text-[13px]">
                  {l.quantity <= 1 ? (
                    <button type="button" disabled={busy} onClick={() => remove(l.id)} aria-label={`Убрать из корзины: ${l.title}`}
                      className="grid h-7 w-9 place-items-center text-muted hover:text-sale disabled:opacity-50">
                      <TrashIcon className="size-4" />
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => update(l.id, l.quantity - 1)} aria-label="Меньше" className="h-7 w-9 disabled:text-subtle">−</button>
                  )}
                  <span className="min-w-6 text-center">{l.quantity}</span>
                  <button type="button" disabled={busy} onClick={() => update(l.id, l.quantity + 1)} aria-label="Больше" className="h-7 w-9 disabled:text-subtle">+</button>
                </div>
                <span className="text-right text-[13px]">
                  {l.base_price && l.base_price > l.unit_price && <s className="mr-1.5 text-muted">{formatPrice(l.base_price * l.quantity)}</s>}
                  {formatPrice(l.total)}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
