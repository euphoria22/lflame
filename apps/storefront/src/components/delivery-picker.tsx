"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { CdekCity, CdekPoint, daysLabel, DeliveryChoice, DeliveryKind, PICKUP, Quote } from "@/lib/delivery"
import { formatPrice } from "@/lib/format"

type Props = {
  value: DeliveryChoice
  onChange: (v: DeliveryChoice) => void
  quote: Quote | null
  onQuote: (q: Quote | null) => void
  error?: string
}

const OPTIONS: { kind: DeliveryKind; title: string; hint: string }[] = [
  { kind: "pickup", title: "Самовывоз из магазина", hint: `${PICKUP.address}, ${PICKUP.hours}` },
  { kind: "cdek-pvz", title: "СДЭК — пункт выдачи", hint: "Доставка до пункта выдачи СДЭК" },
  { kind: "cdek-door", title: "СДЭК — курьер", hint: "Курьер привезёт заказ по адресу" },
  { kind: "pochta", title: "Почта России", hint: "Посылка до отделения по индексу" },
]

/**
 * Выбор способа получения (ТЗ, п. 5.2): город с подсказками СДЭК, пункты выдачи списком
 * с поиском, адрес для курьера и Почты; цена и срок пересчитываются сразу.
 * Карта пунктов выдачи — следующим шагом (нужен ключ Яндекс Карт).
 */
export function DeliveryPicker({ value, onChange, quote, onQuote, error }: Props) {
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (patch: Partial<DeliveryChoice>) => onChange({ ...value, ...patch })

  // Пересчёт цены, когда данных достаточно
  const ready =
    value.kind === "cdek-pvz" ? Boolean(value.city_code && value.pvz_code)
      : value.kind === "cdek-door" ? Boolean(value.city_code)
        : value.kind === "pochta" ? /^\d{6}$/.test(value.postal_code ?? "")
          : false
  useEffect(() => {
    // Сброс ошибки и индикатор загрузки на время запроса к калькулятору
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value.kind === "pickup") { onQuote({ amount: 0, days_min: 0, days_max: 0 }); setQuoteError(null); return }
    if (!ready) { onQuote(null); return }
    let cancelled = false
    setLoading(true)
    setQuoteError(null)
    fetch("/api/delivery/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: value.kind, city_code: value.city_code, postal_code: value.postal_code }),
    })
      .then(async (r) => {
        const d = (await r.json()) as { quote?: Quote; message?: string }
        if (cancelled) return
        if (d.quote) onQuote(d.quote)
        else { onQuote(null); setQuoteError(d.message ?? "Доставка в этот город недоступна") }
      })
      .catch(() => { if (!cancelled) setQuoteError("Не получилось рассчитать доставку") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // onQuote стабилен по смыслу; пересчёт — только при смене входных данных
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.kind, value.city_code, value.pvz_code, value.postal_code, ready])

  return (
    <div className="space-y-2">
      {OPTIONS.map((o) => {
        const on = value.kind === o.kind
        return (
          <div key={o.kind} className={`rounded-xl border transition-colors ${on ? "border-foreground" : "border-line"}`}>
            <label className="flex cursor-pointer items-start gap-3 p-4">
              <input type="radio" name="delivery" checked={on} onChange={() => onChange({ kind: o.kind })} className="mt-1 accent-black" />
              <span className="flex-1 text-[14px]">
                {o.title}
                <span className="mt-1 block text-[12px] text-muted">{o.hint}</span>
              </span>
              <span className="text-right text-[14px]">
                {o.kind === "pickup" ? "0 ₽" : on && quote ? <>{formatPrice(quote.amount)}<span className="block text-[12px] text-muted">{daysLabel(quote)}</span></> : on && loading ? "…" : ""}
              </span>
            </label>

            {on && o.kind !== "pickup" && (
              <div className="space-y-3 border-t border-line p-4">
                {(o.kind === "cdek-pvz" || o.kind === "cdek-door") && (
                  <CityInput value={value.city ?? ""} onSelect={(c) => set({ city: c.city, city_code: c.code, pvz_code: undefined, pvz_address: undefined })} />
                )}
                {o.kind === "cdek-pvz" && value.city_code && (
                  <PointList cityCode={value.city_code} selected={value.pvz_code}
                    onSelect={(p) => set({ pvz_code: p.code, pvz_address: p.address, postal_code: p.postal_code })} />
                )}
                {o.kind === "cdek-door" && (
                  <input className={FIELD} placeholder="Улица, дом, квартира" autoComplete="street-address" value={value.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
                )}
                {o.kind === "pochta" && (
                  <>
                    <div className="grid grid-cols-[1fr_140px] gap-3">
                      <input className={FIELD} placeholder="Город" autoComplete="address-level2" value={value.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
                      <input className={FIELD} placeholder="Индекс" inputMode="numeric" autoComplete="postal-code" maxLength={6}
                        value={value.postal_code ?? ""} onChange={(e) => set({ postal_code: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
                    </div>
                    <input className={FIELD} placeholder="Улица, дом, квартира" autoComplete="street-address" value={value.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
                  </>
                )}
                {quoteError && <p className="text-[12px] text-sale">{quoteError}</p>}
              </div>
            )}
          </div>
        )
      })}
      {error && <p className="text-[12px] text-sale">{error}</p>}
    </div>
  )
}

const FIELD = "h-12 w-full rounded-xl border border-line bg-background px-4 text-[14px] outline-none transition-colors focus:border-foreground"

/** Город с подсказками СДЭК. */
function CityInput({ value, onSelect }: { value: string; onSelect: (c: CdekCity) => void }) {
  const [q, setQ] = useState(value)
  const [list, setList] = useState<CdekCity[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = (text: string) => {
    setQ(text)
    setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    if (text.trim().length < 2) { setList([]); return }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/delivery/cities?q=${encodeURIComponent(text.trim())}`)
      const d = (await r.json().catch(() => ({ cities: [] }))) as { cities: CdekCity[] }
      setList(d.cities ?? [])
    }, 250)
  }

  return (
    <div className="relative">
      <input className={FIELD} placeholder="Город" value={q} onChange={(e) => search(e.target.value)} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} autoComplete="off" aria-label="Город доставки" />
      {open && list.length > 0 && (
        <ul className="glass-strong absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-y-auto rounded-xl p-1">
          {list.map((c) => (
            <li key={c.code}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onSelect(c); setQ(c.city); setOpen(false) }}
                className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-black/5">
                {c.city}<span className="block text-[11px] text-muted">{c.full_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Пункты выдачи СДЭК списком с поиском по адресу. */
function PointList({ cityCode, selected, onSelect }: { cityCode: number; selected?: string; onSelect: (p: CdekPoint) => void }) {
  const [points, setPoints] = useState<CdekPoint[] | null>(null)
  const [q, setQ] = useState("")

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс списка при смене города
    setPoints(null)
    fetch(`/api/delivery/points?city_code=${cityCode}`)
      .then((r) => r.json())
      .then((d: { points: CdekPoint[] }) => { if (!cancelled) setPoints(d.points ?? []) })
      .catch(() => { if (!cancelled) setPoints([]) })
    return () => { cancelled = true }
  }, [cityCode])

  const shown = useMemo(() => (points ?? []).filter((p) => `${p.address} ${p.name}`.toLowerCase().includes(q.toLowerCase())), [points, q])

  if (points === null) return <p className="text-[13px] text-muted">Загружаем пункты выдачи…</p>
  if (!points.length) return <p className="text-[13px] text-muted">В этом городе нет пунктов выдачи СДЭК. Выберите курьера или Почту.</p>

  return (
    <div>
      {points.length > 5 && (
        <input className={`${FIELD} mb-2`} placeholder={`Поиск по адресу · ${points.length} пунктов`} value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <ul className="scroll-subtle max-h-64 space-y-1 overflow-y-auto pr-1">
        {shown.map((p) => (
          <li key={p.code}>
            <button type="button" onClick={() => onSelect(p)}
              className={`block w-full rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${selected === p.code ? "border-foreground bg-surface" : "border-transparent hover:bg-surface"}`}>
              {p.address}
              <span className="block text-[11px] text-muted">{p.work_time}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
