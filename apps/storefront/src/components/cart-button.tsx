"use client"

import { useCart } from "./cart-context"
import { BagIcon } from "./icons"

/** Кнопка корзины в шапке со счётчиком; открывает панель корзины. */
export function CartButton() {
  const { cart, setOpen } = useCart()
  const count = cart?.count ?? 0
  return (
    <button type="button" onClick={() => setOpen(true)} aria-label={`Корзина${count ? `: ${count}` : ""}`} className="relative rounded-full p-2 hover:bg-black/5">
      <BagIcon className="size-[22px]" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background">{count}</span>
      )}
    </button>
  )
}
