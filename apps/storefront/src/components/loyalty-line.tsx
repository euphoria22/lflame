import { formatPrice } from "@/lib/format"
import type { Cart } from "@/lib/cart-types"
import { ClubBadge } from "./order-summary"

/** Скидки в итогах: «Скидка LAFLAMME MEMBER −5%» (ТЗ, п. 6.7) и промокод. Не суммируются — действует одна. */
export function LoyaltyLine({ cart, className = "" }: { cart: Cart | null; className?: string }) {
  if (!cart) return null
  const promo = cart.promo?.applied ? cart.promo : null
  if (!cart.loyalty && !promo) return null
  return (
    <div className={`space-y-1 text-[13px] text-sale ${className}`}>
      {cart.loyalty && (
        <div className="flex justify-between">
          <span className="flex items-center gap-2">Скидка <ClubBadge className="border-sale" /> {cart.loyalty.pct}%</span>
          <span>−{formatPrice(cart.loyalty.saved)}</span>
        </div>
      )}
      {promo && (
        <div className="flex justify-between">
          <span>Промокод {promo.code}</span>
          <span>−{formatPrice(promo.saved)}</span>
        </div>
      )}
    </div>
  )
}

/** Полная стоимость товаров до скидок. */
export const fullGoods = (cart: Cart | null) =>
  (cart?.item_total ?? 0) + (cart?.loyalty?.saved ?? 0) + (cart?.promo?.applied ? cart.promo.saved : 0)
