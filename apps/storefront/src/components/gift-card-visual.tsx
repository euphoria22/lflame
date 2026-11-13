import { LogoMark } from "./logo"
import { formatPrice } from "@/lib/format"

/** Подарочная карта Laflamme: чёрная карта с логотипом, номиналом и местом для кода */
/** code — показать настоящий код вместо «LF-••••» (страница карты) */
export function GiftCardVisual({ amount, to, code, className = "" }: { amount: number | null; to?: string | null; code?: string | null; className?: string }) {
  return (
    <div className={`relative aspect-[1.586] w-full overflow-hidden rounded-[26px] bg-foreground p-6 text-background shadow-[0_30px_60px_-30px_rgba(0,0,0,.55)] md:p-8 ${className}`}>
      {/* Мягкий блик — как стекло на сайте */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <LogoMark className="h-9 w-9 text-background md:h-11 md:w-11" />
          <span className="eyebrow text-background/60">Подарочная карта</span>
        </div>
        <div>
          {to && <p className="mb-1 truncate text-[13px] text-background/60">Кому: {to}</p>}
          <p className="tag-font text-[34px] leading-none tracking-tight md:text-[46px]">{amount ? formatPrice(amount) : "— ₽"}</p>
          <p className="tag-font mt-3 text-[12px] tracking-[0.18em] text-background/50 md:text-[13px]">{code ?? "LF-••••-••••-••••"}</p>
        </div>
      </div>
    </div>
  )
}
