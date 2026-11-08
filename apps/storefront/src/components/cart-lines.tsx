"use client"

import Image from "next/image"
import Link from "next/link"

import { formatPrice } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { Cart } from "@/lib/cart-types"
import { useCart } from "./cart-context"

/** Позиции корзины: панель и страница корзины. */
export function CartLines({ cart, onNavigate }: { cart: Cart; onNavigate?: () => void }) {
  const { update, remove, busy } = useCart()
  return (
    <ul className="divide-y divide-line">
      {cart.lines.map((l) => (
        <li key={l.id} className="flex gap-4 py-4">
          <Link href={l.handle ? routes.product(l.handle) : "#"} onClick={onNavigate} className="relative h-28 w-21 shrink-0 overflow-hidden bg-surface">
            {l.thumbnail && <Image src={l.thumbnail} alt={l.title} fill sizes="84px" className="blend object-contain" />}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={l.handle ? routes.product(l.handle) : "#"} onClick={onNavigate} className="line-clamp-2 text-[13px] leading-snug">{l.title}</Link>
            <p className="mt-1 text-[12px] text-muted">Размер: {l.size}</p>
            <div className="mt-auto flex items-center justify-between pt-2">
              <div className="flex items-center rounded-full border border-line text-[13px]">
                <button type="button" disabled={busy || l.quantity <= 1} onClick={() => update(l.id, l.quantity - 1)} aria-label="Меньше" className="px-3 py-1 disabled:text-subtle">−</button>
                <span className="min-w-6 text-center">{l.quantity}</span>
                <button type="button" disabled={busy} onClick={() => update(l.id, l.quantity + 1)} aria-label="Больше" className="px-3 py-1 disabled:text-subtle">+</button>
              </div>
              <span className="text-[13px]">{formatPrice(l.total)}</span>
            </div>
            <button type="button" disabled={busy} onClick={() => remove(l.id)} className="mt-2 self-start text-[12px] text-muted underline underline-offset-4 hover:text-foreground">Удалить</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
