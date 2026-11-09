"use client"

import Link from "next/link"

import { formatPrice } from "@/lib/format"
import { routes } from "@/lib/routes"
import { useCart } from "./cart-context"
import { CartProgress } from "./cart-progress"
import { CartLines } from "./cart-lines"
import { LoyaltyLine } from "./loyalty-line"

export function CartPageView() {
  const { cart, error } = useCart()
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 md:px-8">
      <h1 className="text-[28px] tracking-tight md:text-[40px]">Корзина</h1>
      {error && <p className="mt-4 rounded-xl bg-sale/10 px-4 py-2 text-[13px] text-sale" role="alert">{error}</p>}
      {cart && cart.lines.length ? (
        <div className="mt-8 grid gap-10 md:grid-cols-[1fr_320px]">
          <CartLines cart={cart} />
          <aside className="h-fit rounded-[22px] bg-surface p-6 md:sticky md:top-[96px]">
            <div className="flex justify-between text-[15px]"><span>Товары</span><span>{formatPrice(cart.item_total + (cart.loyalty?.saved ?? 0))}</span></div>
            <LoyaltyLine cart={cart} className="mt-1" />
            {cart.loyalty && <div className="mt-1 flex justify-between text-[15px]"><span>Итого</span><span>{formatPrice(cart.item_total)}</span></div>}
            <CartProgress total={cart.item_total} className="mt-3" />
            <Link href="/checkout" className="mt-6 flex h-12 items-center justify-center rounded-full bg-foreground text-[14px] text-background">Оформить заказ</Link>
          </aside>
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="text-[15px]">{cart === null ? "В корзине пока пусто" : "Загружаем корзину…"}</p>
          <Link href={routes.newIn()} className="mt-4 inline-block rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Смотреть новинки</Link>
        </div>
      )}
    </div>
  )
}
