"use client"

import Link from "next/link"

import { formatPrice } from "@/lib/format"
import { routes } from "@/lib/routes"
import { useCart } from "./cart-context"
import { CartProgress } from "./cart-progress"
import { CartLines } from "./cart-lines"
import { OrderSummary } from "./order-summary"

export function CartPageView() {
  const { cart, error } = useCart()
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 md:px-8">
      <h1 className="text-[28px] tracking-tight md:text-[40px]">Корзина</h1>
      {error && <p className="mt-4 rounded-xl bg-sale/10 px-4 py-2 text-[13px] text-sale" role="alert">{error}</p>}
      {cart && cart.lines.length ? (
        <div className="mt-8 grid grid-cols-1 gap-10 pb-24 md:grid-cols-[minmax(0,1fr)_360px] md:pb-0">
          <CartLines cart={cart} />
          <aside className="h-fit rounded-[22px] bg-surface p-6 md:sticky md:top-[96px]">
            <p className="mb-5 text-[22px] tracking-tight">Ваш заказ</p>
            <OrderSummary cart={cart} />
            <Link href="/checkout" className="mt-6 flex h-12 items-center justify-center rounded-full bg-foreground text-[14px] text-background">Оформить заказ</Link>
            <CartProgress total={cart.goods_total} className="mt-5 border-t border-line pt-5" />
          </aside>
          {/* На телефоне — итог и кнопка всегда под рукой */}
          <div className="glass fixed inset-x-2 bottom-2 z-40 flex items-center gap-3 rounded-full p-1.5 pl-5 md:hidden">
            <div className="flex-1 leading-tight"><p className="text-[11px] text-muted">Итого</p><p className="text-[16px]">{formatPrice(cart.item_total)}</p></div>
            <Link href="/checkout" className="flex h-11 items-center rounded-full bg-foreground px-6 text-[14px] text-background">Продолжить</Link>
          </div>
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
