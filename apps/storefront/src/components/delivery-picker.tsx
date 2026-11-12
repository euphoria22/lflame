"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import dynamic from "next/dynamic"

import { CdekCity, CdekPoint, daysLabel, DeliveryChoice, DeliveryKind, PICKUP, PochtaOffice, Quote } from "@/lib/delivery"
import { formatPrice } from "@/lib/format"
import { CourierIcon, MailIcon, MethodLogo, PickupPointIcon, StoreIcon, TruckIcon } from "./method-icons"

// Карта грузится только когда нужна (Leaflet работает лишь в браузере)
const PickupMap = dynamic(() => import("./pickup-map").then((m) => m.PickupMap), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse rounded-xl bg-surface md:h-[380px]" />,
})

type Props = {
  value: DeliveryChoice
  onChange: (v: DeliveryChoice) => void
  quote: Quote | null
  onQuote: (q: Quote | null) => void
  error?: string
  /** Меняется вместе с составом корзины — цена доставки пересчитывается */
  refreshKey?: string
  /** Название, описание и логотип из админки («Доставка и оплата») */
  texts?: Partial<Record<DeliveryKind, { title: string; hint: string; logo: string | null }>>
}

const ICONS: Record<DeliveryKind, (p: { className?: string }) => React.ReactElement> = {
  "pickup": StoreIcon, "omsk-courier": CourierIcon, "cdek-pvz": PickupPointIcon, "cdek-door": TruckIcon, "pochta": MailIcon,
}

const OPTIONS: { kind: DeliveryKind; title: string; hint: string }[] = [
  { kind: "cdek-pvz", title: "СДЭК — пункт выдачи", hint: "Доставка до пункта выдачи СДЭК" },
  { kind: "pochta", title: "Почта России", hint: "Посылка до почтового отделения" },
  { kind: "cdek-door", title: "СДЭК — курьер", hint: "Курьер привезёт заказ по адресу" },
  { kind: "pickup", title: "Самовывоз из магазина", hint: `${PICKUP.address}, ${PICKUP.hours}` },
  { kind: "omsk-courier", title: "Курьер по Омску", hint: "1–3 часа, время согласуем по телефону" },
]

/**
 * Выбор способа получения (ТЗ, п. 5.2): город с подсказками СДЭК, пункты выдачи и отделения
 * Почты на карте и списком с поиском, адрес для курьера; цена и срок пересчитываются сразу.
 */
export function DeliveryPicker({ value, onChange, quote, onQuote, error, refreshKey, texts }: Props) {
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (patch: Partial<DeliveryChoice>) => onChange({ ...value, ...patch })

  // Пересчёт цены, когда данных достаточно
  const ready =
    value.kind === "cdek-pvz" ? Boolean(value.city_code && value.pvz_code)
      : value.kind === "cdek-door" ? Boolean(value.city_code)
        : value.kind === "pochta" ? /^\d{6}$/.test(value.postal_code ?? "")
          : value.kind === "omsk-courier"
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
  }, [value.kind, value.city_code, value.pvz_code, value.postal_code, ready, refreshKey])

  return (
    <div className="space-y-2">
      {OPTIONS.map((base) => {
        const t = texts?.[base.kind]
        const o = { ...base, title: t?.title || base.title, hint: t?.hint ?? base.hint, logo: t?.logo ?? null }
        const on = value.kind === o.kind
        return (
          <div key={o.kind} className={`rounded-xl border transition-colors ${on ? "border-foreground" : "border-line"}`}>
            <label className="flex cursor-pointer items-center gap-3 p-4">
              <input type="radio" name="delivery" checked={on} onChange={() => onChange({ kind: o.kind })} className="accent-black" />
              <MethodLogo logo={o.logo} alt={o.title} Fallback={ICONS[o.kind]} />
              <span className="flex-1 text-[14px]">
                {o.title}
                {o.hint && <span className="mt-1 block text-[12px] text-muted">{o.hint}</span>}
              </span>
              <span className="text-right text-[14px]">
                {o.kind === "pickup" ? "0 ₽" : on && quote ? <>{quote.free ? <><s className="mr-1.5 text-muted">{formatPrice(quote.full_amount ?? 0)}</s>Бесплатно</> : formatPrice(quote.amount)}<span className="block text-[12px] text-muted">{daysLabel(quote)}</span></> : on && loading ? "…" : ""}
              </span>
            </label>

            {on && o.kind !== "pickup" && (
              <div className="space-y-3 border-t border-line p-4">
                {o.kind === "omsk-courier" ? (
                  <input className={FIELD} placeholder="Адрес в Омске: улица, дом, квартира" autoComplete="street-address"
                    value={value.address ?? ""} onChange={(e) => set({ address: e.target.value, city: "Омск" })} />
                ) : (
                  <CityInput value={value.city ?? ""}
                    onSelect={(c) => set({ city: c.city, city_code: c.code, region: c.full_name.split(",")[1]?.trim() || undefined, pvz_code: undefined, pvz_address: undefined, ...(o.kind === "pochta" ? { postal_code: undefined, address: undefined } : {}) })} />
                )}
                {o.kind === "cdek-pvz" && value.city_code && (
                  <CdekPoints cityCode={value.city_code} selected={value.pvz_code}
                    onSelect={(p) => set({ pvz_code: p.code, pvz_address: p.address, postal_code: p.postal_code })} />
                )}
                {o.kind === "cdek-door" && (
                  <input className={FIELD} placeholder="Улица, дом, квартира" autoComplete="street-address" value={value.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
                )}
                {o.kind === "pochta" && value.city_code && (
                  <PochtaOffices cityCode={value.city_code} value={value} onChange={set} />
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
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = (text: string) => {
    setQ(text)
    setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    if (text.trim().length < 2) { setList([]); return }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/delivery/cities?q=${encodeURIComponent(text.trim())}`).catch(() => null)
      const d = (await r?.json().catch(() => null)) as { cities?: CdekCity[] } | null
      setFailed(!r?.ok)
      setList(d?.cities ?? [])
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
      {failed && <p className="mt-1 text-[12px] text-sale">Не удалось загрузить города: СДЭК не отвечает. Попробуйте через минуту.</p>}
    </div>
  )
}

type Place = { id: string; address: string; sub: string; lat: number; lon: number }

/** Карта + поиск + список. Выбор на карте и в списке синхронизирован. */
function PlacePicker({ places, selected, onSelect, noun }: { places: Place[]; selected?: string; onSelect: (id: string) => void; noun: string }) {
  const [q, setQ] = useState("")
  const [view, setView] = useState<"map" | "list">("map")
  const shown = useMemo(() => places.filter((p) => `${p.address} ${p.id}`.toLowerCase().includes(q.toLowerCase())), [places, q])
  const points = useMemo(() => places.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, title: p.address })), [places])
  const chosen = places.find((p) => p.id === selected)
  const list = useRef<HTMLUListElement>(null)

  // Выбор на карте — прокручиваем список к пункту
  useEffect(() => {
    list.current?.querySelector(`[data-id="${CSS.escape(selected ?? "")}"]`)?.scrollIntoView({ block: "nearest" })
  }, [selected])

  return (
    <div className="space-y-2">
      <div className="flex gap-1 md:hidden" role="tablist">
        {(["map", "list"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`h-9 flex-1 rounded-full text-[13px] ${view === v ? "bg-foreground text-background" : "bg-surface"}`}>
            {v === "map" ? "На карте" : "Списком"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <div className={view === "list" ? "hidden md:block" : ""}>
          <PickupMap points={points} selected={selected} onSelect={onSelect} />
        </div>
        <div className={`flex flex-col ${view === "map" ? "hidden md:flex" : ""}`}>
          <input className={`${FIELD} mb-2 h-10 text-[13px]`} placeholder={`Поиск · ${places.length} ${noun}`} value={q} onChange={(e) => setQ(e.target.value)} />
          <ul ref={list} className="scroll-subtle max-h-[320px] space-y-1 overflow-y-auto pr-1 md:max-h-[330px]">
            {shown.map((p) => (
              <li key={p.id} data-id={p.id}>
                <button type="button" onClick={() => onSelect(p.id)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${selected === p.id ? "border-foreground bg-surface" : "border-transparent hover:bg-surface"}`}>
                  {p.address}
                  <span className="block text-[11px] text-muted">{p.sub}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-2 text-[13px] text-muted">Ничего не нашлось</li>}
          </ul>
        </div>
      </div>
      {chosen && (
        <p className="rounded-lg bg-surface px-3 py-2 text-[13px]">
          <span className="text-muted">Выбран: </span>{chosen.address}<span className="block text-[11px] text-muted">{chosen.sub}</span>
        </p>
      )}
    </div>
  )
}

/** Пункты выдачи СДЭК города. */
function CdekPoints({ cityCode, selected, onSelect }: { cityCode: number; selected?: string; onSelect: (p: CdekPoint) => void }) {
  const [points, setPoints] = useState<CdekPoint[] | null>(null)

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

  const places = useMemo(() => (points ?? []).map((p) => ({ id: p.code, address: p.address, sub: p.work_time, lat: p.lat, lon: p.lon })), [points])

  if (points === null) return <p className="text-[13px] text-muted">Загружаем пункты выдачи…</p>
  if (!points.length) return <p className="text-[13px] text-muted">В этом городе нет пунктов выдачи СДЭК. Выберите курьера или Почту.</p>
  return <PlacePicker places={places} selected={selected} noun="пунктов" onSelect={(id) => { const p = points.find((x) => x.code === id); if (p) onSelect(p) }} />
}

/** Отделения Почты: карта, если подключён API «Отправки», иначе — индекс и адрес вручную. */
function PochtaOffices({ cityCode, value, onChange }: { cityCode: number; value: DeliveryChoice; onChange: (p: Partial<DeliveryChoice>) => void }) {
  const [data, setData] = useState<{ available: boolean; offices: PochtaOffice[] } | null>(null)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс списка при смене города
    setData(null)
    fetch(`/api/delivery/pochta-offices?city_code=${cityCode}`)
      .then((r) => r.json())
      .then((d: { available: boolean; offices: PochtaOffice[] }) => { if (!cancelled) setData({ available: d.available, offices: d.offices ?? [] }) })
      .catch(() => { if (!cancelled) setData({ available: false, offices: [] }) })
    return () => { cancelled = true }
  }, [cityCode])

  const places = useMemo(() => (data?.offices ?? []).map((o) => ({ id: o.postal_code, address: o.address, sub: `${o.postal_code} · ${o.work_time}`, lat: o.lat, lon: o.lon })), [data])

  if (data === null) return <p className="text-[13px] text-muted">Загружаем отделения…</p>

  if (data.offices.length && !manual) {
    return (
      <>
        <PlacePicker places={places} selected={value.pvz_code} noun="отделений" onSelect={(id) => {
          const o = data.offices.find((x) => x.postal_code === id)
          if (o) onChange({ pvz_code: o.postal_code, pvz_address: o.address, postal_code: o.postal_code, address: `До востребования, отделение ${o.postal_code}` })
        }} />
        <button type="button" className="text-[12px] text-muted underline underline-offset-4" onClick={() => { setManual(true); onChange({ pvz_code: undefined, address: "" }) }}>
          Доставить на домашний адрес
        </button>
      </>
    )
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <input className={FIELD} placeholder="Улица, дом, квартира" autoComplete="street-address" value={value.address ?? ""} onChange={(e) => onChange({ address: e.target.value })} />
        <input className={FIELD} placeholder="Индекс" inputMode="numeric" autoComplete="postal-code" maxLength={6}
          value={value.postal_code ?? ""} onChange={(e) => onChange({ postal_code: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
      </div>
      <p className="text-[12px] text-muted">Посылка придёт в отделение по вашему индексу, извещение — в приложении Почты или в ящике.</p>
    </>
  )
}
