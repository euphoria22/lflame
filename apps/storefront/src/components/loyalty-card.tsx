import Link from "next/link"

import { formatPrice } from "@/lib/format"

export type Tier = { code: string; name: string; threshold: number; discount: number }
export type LoyaltyStatus = {
  enabled: boolean
  phone: string | null
  confirmed: boolean
  level: Tier
  total: number
  next: Tier | null
  to_next: number
  tiers: Tier[]
  forecast: { level: string; future: string; need: number; until: string } | null
  pending: number
  history: { date: string; title: string; amount: number; status: string; source: string }[]
}

const date = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })

/** Уровень, прогресс до следующего, предупреждение о понижении (ТЗ, п. 6.7 «Личный кабинет»). */
export function LoyaltyCard({ s }: { s: LoyaltyStatus }) {
  if (!s.enabled) return null
  if (!s.confirmed) {
    return (
      <div className="rounded-[22px] bg-foreground p-6 text-background">
        <p className="eyebrow opacity-60">LAFLAMME Club</p>
        <p className="mt-2 text-[20px]">Уровень по телефону</p>
        <p className="mt-2 text-[13px] leading-relaxed opacity-70">
          {s.phone
            ? "Телефон из профиля подтвердится после первого заказа с ним. Если вы уже покупали в магазине — укажите тот же номер, что давали продавцу."
            : "Укажите телефон в профиле — по нему мы найдём ваши покупки в магазине и на сайте и посчитаем уровень."}
        </p>
        <Link href="/loyalty" className="mt-4 inline-block text-[13px] underline underline-offset-4 opacity-80">Как работает программа</Link>
      </div>
    )
  }
  const pct = s.next ? Math.min(100, Math.round(((s.total - s.level.threshold) / (s.next.threshold - s.level.threshold)) * 100)) : 100
  return (
    <div className="rounded-[22px] bg-foreground p-6 text-background">
      <p className="eyebrow opacity-60">LAFLAMME Club</p>
      <div className="mt-2 flex items-baseline justify-between">
        <p className="text-[26px] tracking-tight">{s.level.name}</p>
        <p className="text-[15px]">{s.level.discount ? `−${s.level.discount}%` : ""}</p>
      </div>
      <p className="mt-1 text-[13px] opacity-70">Покупки за 12 месяцев: {formatPrice(s.total)}</p>
      {s.next ? (
        <>
          <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/20" aria-hidden>
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[12px] opacity-70">До {s.next.name} (−{s.next.discount}%) — {formatPrice(s.to_next)}</p>
        </>
      ) : (
        <p className="mt-3 text-[12px] opacity-70">Высший уровень программы</p>
      )}
      {s.pending > 0 && <p className="mt-2 text-[12px] opacity-70">Ожидают зачёта: {formatPrice(s.pending)} — через 7 дней после получения заказа</p>}
      {s.forecast && (
        <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[12px]">
          Сохраните уровень {s.forecast.level}: купите на {formatPrice(s.forecast.need)} до {date(s.forecast.until)}
        </p>
      )}
      {!!s.history.length && (
        <details className="mt-4 text-[12px]">
          <summary className="opacity-70 hover:opacity-100">История покупок</summary>
          <ul className="mt-2 space-y-1.5">
            {s.history.slice(0, 20).map((h, i) => (
              <li key={i} className="flex justify-between gap-3 opacity-80">
                <span>{new Date(h.date).toLocaleDateString("ru-RU")} · {h.title}{h.status === "pending" ? " · ожидает" : ""}</span>
                <span className="whitespace-nowrap">{h.amount > 0 ? "+" : ""}{formatPrice(h.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Link href="/loyalty" className="mt-4 inline-block text-[12px] underline underline-offset-4 opacity-70">Уровни и условия</Link>
    </div>
  )
}
