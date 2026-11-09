import Image from "next/image"
import Link from "next/link"

import type { AccountOrder, LoyaltyStatus } from "@/lib/account-types"
import { orderDate, STATUS_STYLE } from "@/lib/account-status"
import { formatPrice, plural } from "@/lib/format"

/** Белая карточка раздела кабинета с заголовком и ссылкой справа. */
export function Card({ title, action, children, className = "" }: { title?: React.ReactNode; action?: { label: string; href: string }; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] border border-line bg-background p-5 md:p-8 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex items-baseline justify-between gap-4">
          {title && <h2 className="text-[22px] tracking-tight md:text-[26px]">{title}</h2>}
          {action && <Link href={action.href} className="shrink-0 text-[13px] underline underline-offset-4 hover:opacity-60">{action.label} →</Link>}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatusBadge({ s }: { s: AccountOrder["status"] }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] ${STATUS_STYLE[s.code] ?? "bg-surface"}`}>{s.label}</span>
}

/** Строка заказа: фото (до 3), номер, дата, количество, сумма, статус. */
export function OrderRow({ o }: { o: AccountOrder }) {
  const count = o.items.reduce((s, i) => s + i.quantity, 0)
  const thumbs = o.items.filter((i) => i.thumbnail).slice(0, 3)
  return (
    <Link href={`/account/orders/${o.id}`} className="group flex items-center gap-4 py-4 md:gap-6">
      <span className="flex shrink-0 overflow-hidden rounded-xl bg-surface">
        {thumbs.map((i) => (
          <span key={i.id} className="relative block h-16 w-12 md:h-20 md:w-16">
            <Image src={i.thumbnail!} alt="" fill sizes="64px" className="blend object-contain" />
          </span>
        ))}
        {!thumbs.length && <span className="block h-16 w-12 md:h-20 md:w-16" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">Заказ № {o.number}</span>
        <span className="block text-[12px] text-muted">{orderDate(o.created_at)} · {count} {plural(count, ["товар", "товара", "товаров"])}</span>
        <span className="mt-1 block text-[15px] md:hidden">{formatPrice(o.total)}</span>
      </span>
      <span className="hidden w-28 text-right text-[15px] md:block">{formatPrice(o.total)}</span>
      <span className="hidden sm:block"><StatusBadge s={o.status} /></span>
      <span aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5">›</span>
    </Link>
  )
}

/** Laflamme Club в кабинете: уровень, скидка, сумма покупок, сколько до следующего уровня, шкала уровней. */
export function ClubCard({ s, compact = false }: { s: LoyaltyStatus; compact?: boolean }) {
  const tiers = [...s.tiers].sort((a, b) => a.threshold - b.threshold)
  const idx = tiers.findIndex((t) => t.code === s.level.code)
  const pct = s.next ? Math.min(100, Math.max(2, ((s.total - s.level.threshold) / (s.next.threshold - s.level.threshold)) * 100)) : 100
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Программа лояльности</p>
          <p className="mt-1 text-[24px] tracking-tight md:text-[28px]">Laflamme Club</p>
        </div>
        {compact && <Link href="/account/club" className="shrink-0 pt-5 text-[13px] underline underline-offset-4 hover:opacity-60">Подробнее →</Link>}
      </div>
      {!s.confirmed ? (
        <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-muted">
          {s.phone
            ? "Телефон из профиля подтвердится после первого заказа с ним. Если вы уже покупали в магазине — укажите тот же номер, что давали продавцу."
            : "Укажите телефон в профиле — по нему мы найдём ваши покупки в магазине и на сайте и посчитаем уровень."}
        </p>
      ) : (
        <>
          <div className="mt-6 flex items-end justify-between gap-4">
            <div><p className="text-[13px] text-muted">Ваш уровень</p><p className="mt-1 text-[32px] leading-none tracking-tight md:text-[40px]">{s.level.name}</p></div>
            <div className="text-right"><p className="text-[13px] text-muted">Ваша скидка</p><p className="mt-1 text-[32px] leading-none tracking-tight md:text-[40px]">{s.level.discount}%</p></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-[14px]">
            <div><p className="text-[13px] text-muted">Сумма покупок за 12 месяцев</p><p className="mt-1 text-[17px]">{formatPrice(s.total)}</p></div>
            {s.next && <div><p className="text-[13px] text-muted">До уровня {s.next.name}</p><p className="mt-1 text-[17px]">Осталось {formatPrice(s.to_next)}</p></div>}
          </div>
          <div className="mt-6 h-[4px] overflow-hidden rounded-full bg-club/20" aria-hidden>
            <div className="h-full rounded-full bg-club" style={{ width: `${pct}%` }} />
          </div>
          {/* Шкала уровней: пройденные — закрашены */}
          <ol className="relative mt-5 grid" style={{ gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))` }}>
            <span aria-hidden className="absolute left-[10%] right-[10%] top-[5px] h-px bg-line" />
            {tiers.map((t, i) => (
              <li key={t.code} className="relative flex flex-col items-center gap-1.5 text-center">
                <span className={`size-[11px] rounded-full border-2 ${i <= idx ? "border-foreground bg-foreground" : "border-subtle bg-background"}`} />
                <span className={`text-[11px] ${i === idx ? "font-medium text-foreground" : "text-muted"}`}>{t.name}</span>
              </li>
            ))}
          </ol>
          {s.pending > 0 && <p className="mt-5 text-[12px] text-muted">Ожидают зачёта: {formatPrice(s.pending)} — через 7 дней после получения заказа.</p>}
          {s.forecast && (
            <p className="mt-3 rounded-xl bg-surface px-4 py-3 text-[13px]">
              Сохраните уровень {s.forecast.level}: купите на {formatPrice(s.forecast.need)} до {new Date(s.forecast.until).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
            </p>
          )}
        </>
      )}
    </Card>
  )
}
