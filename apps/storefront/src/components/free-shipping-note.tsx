import { formatPrice } from "@/lib/format"
import { FREE_SHIPPING_FROM } from "@/lib/site"

/** Подсказка в корзине: сколько осталось до бесплатной доставки. */
export function FreeShippingNote({ total }: { total: number }) {
  if (!FREE_SHIPPING_FROM) return <p className="mt-1 text-[12px] text-muted">Доставка рассчитывается при оформлении</p>
  const left = FREE_SHIPPING_FROM - total
  const pct = Math.min(100, Math.round((total / FREE_SHIPPING_FROM) * 100))
  return (
    <div className="mt-2">
      <p className="text-[12px] text-muted">
        {left > 0 ? <>До бесплатной доставки осталось <span className="text-foreground">{formatPrice(left)}</span></> : "Доставка бесплатно: СДЭК и Почта России"}
      </p>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
