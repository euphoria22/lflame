import { discountPercent, formatPrice } from "@/lib/format"

/** Цена, зачёркнутая цена и скидка текстом (без плашек — по обратной связи 08.11.2026). */
export function Price({ price, compareAt, size = "sm" }: { price: number; compareAt: number | null; size?: "sm" | "lg" }) {
  const off = discountPercent(price, compareAt)
  const cls = size === "lg" ? "text-[18px]" : "text-[12px]"
  return (
    <span className={`tag-font inline-flex flex-wrap items-baseline gap-x-2 ${cls}`}>
      <span>{formatPrice(price)}</span>
      {off && <s className="text-subtle">{formatPrice(compareAt!)}</s>}
      {off && <span className={`text-sale ${size === "lg" ? "text-[14px]" : ""}`}>−{off}%</span>}
    </span>
  )
}
