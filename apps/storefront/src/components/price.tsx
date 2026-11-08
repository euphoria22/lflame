import { discountPercent, formatPrice } from "@/lib/format"

export function Price({ price, compareAt, size = "sm" }: { price: number; compareAt: number | null; size?: "sm" | "lg" }) {
  const off = discountPercent(price, compareAt)
  const cls = size === "lg" ? "text-[20px]" : "text-[13px]"
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${cls}`}>
      <span>{formatPrice(price)}</span>
      {off && <s className="text-subtle">{formatPrice(compareAt!)}</s>}
    </span>
  )
}
