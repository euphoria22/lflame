import { LogoMark } from "./logo"
import { formatPrice } from "@/lib/format"

/** Подарочная карта Laflamme: чёрная карта с логотипом, номиналом и местом для кода */
/**
 * code — показать настоящий код вместо «LF-••••» (страница карты).
 * codeHref — скрытая ссылка на коде (продавец нажимает на код и попадает в админку; внешне не выделена)
 */
export function GiftCardVisual({ amount, to, code, codeHref, className = "" }: { amount: number | null; to?: string | null; code?: string | null; codeHref?: string; className?: string }) {
  return (
    // Сама карта — колонка flex: без height:100% внутри (Safari считает его от высоты с отступами — содержимое съезжало вниз и код обрезался)
    <div className={`relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[26px] bg-foreground p-6 text-background shadow-[0_30px_60px_-30px_rgba(0,0,0,.55)] md:p-8 ${className}`}>
      {/* Мягкий блик — как стекло на сайте */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="relative flex items-start justify-between">
        <LogoMark className="h-9 w-9 text-background md:h-11 md:w-11" />
        <span className="eyebrow text-background/60">Подарочная карта</span>
      </div>
      <div className="relative">
        {to && <p className="mb-1 truncate text-[13px] text-background/60">Кому: {to}</p>}
        <p className="tag-font text-[34px] leading-none tracking-tight md:text-[46px]">{amount ? formatPrice(amount) : "— ₽"}</p>
        <p className="tag-font mt-3 text-[12px] tracking-[0.18em] text-background/50 md:text-[13px]">
          {codeHref && code ? <a href={codeHref} className="cursor-default">{code}</a> : code ?? "LF-••••-••••-••••"}
        </p>
      </div>
    </div>
  )
}
