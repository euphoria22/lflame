import { formatPrice } from "@/lib/format"
import type { Cart } from "@/lib/cart-types"

/** Строка «Скидка LAFLAMME MEMBER −5%» в корзине и оформлении (ТЗ, п. 6.7). */
export function LoyaltyLine({ cart, className = "" }: { cart: Cart | null; className?: string }) {
  if (!cart?.loyalty) return null
  return (
    <div className={`flex justify-between text-[13px] text-sale ${className}`}>
      <span>Скидка LAFLAMME {cart.loyalty.level} −{cart.loyalty.pct}%</span>
      <span>−{formatPrice(cart.loyalty.saved)}</span>
    </div>
  )
}
