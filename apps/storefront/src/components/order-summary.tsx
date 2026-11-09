"use client"

import type { Cart } from "@/lib/cart-types"
import { formatPrice } from "@/lib/format"
import { PromoField } from "./promo-field"

/** Плашка «Laflamme Club» — как вкладка, капслоком в рамке. */
export function ClubBadge({ className = "" }: { className?: string }) {
  return <span className={`eyebrow inline-flex items-center rounded-full border border-foreground px-2 py-[3px] text-[10px] leading-none ${className}`}>Laflamme Club</span>
}

/** Суммы корзины по строкам: полная цена, уценка, скидка Club, промокод. */
export function cartBreakdown(cart: Cart) {
  let full = 0, sale = 0
  for (const l of cart.lines) {
    const price = l.base_price ?? l.unit_price // цена до скидки Club
    const was = l.compare_at && l.compare_at > price ? l.compare_at : price
    full += was * l.quantity
    sale += (was - price) * l.quantity
  }
  const club = cart.loyalty?.saved ?? 0
  const promo = cart.promo?.applied ? cart.promo.saved : 0
  return { full: Math.round(full), sale: Math.round(sale), club, promo }
}

const Row = ({ label, value, muted = false }: { label: React.ReactNode; value: React.ReactNode; muted?: boolean }) => (
  <div className="flex items-center justify-between gap-4 text-[14px]">
    <span className="flex items-center gap-2 text-muted">{label}</span>
    <span className={muted ? "text-muted" : ""}>{value}</span>
  </div>
)

/**
 * «Ваш заказ» — как на прежнем сайте: товаров на (полная цена), скидка Laflamme Club, промокод,
 * скидки на товары, доставка, поле промокода и крупное «Итого».
 * delivery: undefined — «на этапе оформления» (корзина), число — цена (оформление), null — ещё не выбрана.
 */
export function OrderSummary({ cart, delivery, promoInput = true }: { cart: Cart; delivery?: number | null; promoInput?: boolean }) {
  const b = cartBreakdown(cart)
  const discounted = b.full > cart.item_total
  const total = cart.item_total + (typeof delivery === "number" ? delivery : 0)
  return (
    <div>
      <div className="space-y-2.5">
        <Row label="Товаров на:" value={discounted ? <s className="text-muted">{formatPrice(b.full)}</s> : formatPrice(b.full)} />
        {!!b.club && cart.loyalty && (
          <Row label={<>Скидка <ClubBadge /> <span className="text-foreground">{cart.loyalty.pct}%</span></>} value={<span className="text-sale">−{formatPrice(b.club)}</span>} />
        )}
        {!!b.promo && cart.promo && <Row label={<>Промокод <span className="eyebrow text-foreground">{cart.promo.code}</span></>} value={<span className="text-sale">−{formatPrice(b.promo)}</span>} />}
        {!!b.sale && <Row label="Скидки на товары:" value={<span className="text-sale">−{formatPrice(b.sale)}</span>} />}
        <Row label="Доставка:" value={delivery === undefined ? "На этапе оформления" : delivery === null ? "—" : delivery === 0 ? "Бесплатно" : formatPrice(delivery)} muted={delivery === undefined || delivery === null} />
      </div>
      {promoInput && <div className="mt-5 border-t border-line pt-5"><PromoField defaultOpen /></div>}
      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
        <span className="text-[18px]">Итого:</span>
        <span className="text-[24px] tracking-tight">{formatPrice(total)}</span>
      </div>
    </div>
  )
}
