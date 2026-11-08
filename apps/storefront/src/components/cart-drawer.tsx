"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { formatPrice, plural } from "@/lib/format"
import { routes } from "@/lib/routes"
import { useCart } from "./cart-context"
import { CartLines } from "./cart-lines"
import { FreeShippingNote } from "./free-shipping-note"
import { CloseIcon } from "./icons"

/** Выезжающая панель корзины (Liquid Glass) — открывается после добавления товара. */
export function CartDrawer() {
  const { cart, open, setOpen, error } = useCart()
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname, setOpen])

  useEffect(() => {
    if (!open) return
    document.documentElement.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", onKey) }
  }, [open, setOpen])

  if (!open) return null
  const count = cart?.count ?? 0

  return (
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label="Корзина">
      <div className="absolute inset-0 bg-black/25" onClick={() => setOpen(false)} />
      <div className="glass-strong absolute inset-y-2 right-2 flex w-[calc(100%-16px)] max-w-[440px] flex-col rounded-[28px]">
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <p className="text-[17px]">Корзина{count ? ` · ${count} ${plural(count, ["товар", "товара", "товаров"])}` : ""}</p>
          <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-black/5"><CloseIcon className="size-6" /></button>
        </div>
        {error && <p className="mx-6 rounded-xl bg-sale/10 px-4 py-2 text-[13px] text-sale" role="alert">{error}</p>}
        {cart && cart.lines.length ? (
          <>
            <div className="scroll-subtle flex-1 overflow-y-auto px-6"><CartLines cart={cart} onNavigate={() => setOpen(false)} /></div>
            <div className="border-t border-line px-6 pb-5 pt-4">
              <div className="flex justify-between text-[15px]"><span>Итого</span><span>{formatPrice(cart.item_total)}</span></div>
              <FreeShippingNote total={cart.item_total} />
              <Link href="/checkout" onClick={() => setOpen(false)} className="mt-4 flex h-12 items-center justify-center rounded-full bg-foreground text-[14px] text-background">Оформить заказ</Link>
              <Link href={routes.cart()} onClick={() => setOpen(false)} className="mt-2 block text-center text-[13px] text-muted underline underline-offset-4">Перейти в корзину</Link>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="text-[15px]">В корзине пока пусто</p>
            <Link href={routes.newIn()} onClick={() => setOpen(false)} className="mt-4 rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Смотреть новинки</Link>
          </div>
        )}
      </div>
    </div>
  )
}
