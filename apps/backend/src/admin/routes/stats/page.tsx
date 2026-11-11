import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Bucket = { key: string; orders: number; revenue: number; qty?: number }
type Stats = {
  summary: {
    orders: number; revenue: number; avg_check: number; items: number; canceled: number
    paid_orders: number; new_customers: number; returning_customers: number; discount: number
    prev_orders: number; prev_revenue: number
  }
  by_day: Bucket[]
  cities: Bucket[]; regions: Bucket[]; delivery: Bucket[]; payment: Bucket[]
  products: Bucket[]; brands: Bucket[]; categories: Bucket[]; promo: Bucket[]
}

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`
const day = (d: Date) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10)
const ago = (n: number) => day(new Date(Date.now() - n * 86400000))

/** Готовые периоды: последние N дней, текущий и прошлый месяц, год. */
function presets(): { label: string; from: string; to: string }[] {
  const now = new Date(Date.now() + 3 * 3600000)
  const y = now.getUTCFullYear(), m = now.getUTCMonth()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return [
    { label: "7 дней", from: ago(6), to: ago(0) },
    { label: "30 дней", from: ago(29), to: ago(0) },
    { label: "90 дней", from: ago(89), to: ago(0) },
    { label: "Этот месяц", from: iso(new Date(Date.UTC(y, m, 1))), to: ago(0) },
    { label: "Прошлый месяц", from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) },
    { label: "Год", from: ago(364), to: ago(0) },
  ]
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return now ? <span className="text-ui-fg-subtle text-xs">прошлый период — 0</span> : null
  const pct = Math.round(((now - prev) / prev) * 100)
  return <span className={`text-xs ${pct >= 0 ? "text-ui-tag-green-text" : "text-ui-tag-red-text"}`}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}% к прошлому периоду</span>
}

function Kpi({ title, value, hint }: { title: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ui-border-base p-4">
      <Text size="small" className="text-ui-fg-subtle">{title}</Text>
      <p className="mt-1 text-2xl font-medium text-ui-fg-base">{value}</p>
      {hint && <div className="mt-1">{hint}</div>}
    </div>
  )
}

/** Список с полосками: доля выручки, заказы, штуки. */
function Bars({ title, rows, unit = "revenue" }: { title: string; rows: Bucket[]; unit?: "revenue" | "qty" }) {
  const total = rows.reduce((s, r) => s + (unit === "qty" ? r.qty ?? 0 : r.revenue), 0)
  const max = Math.max(1, ...rows.map((r) => (unit === "qty" ? r.qty ?? 0 : r.revenue)))
  return (
    <Container className="p-0">
      <div className="px-6 py-4"><Heading level="h2">{title}</Heading></div>
      <div className="flex flex-col gap-2 px-6 pb-5">
        {!rows.length && <Text size="small" className="text-ui-fg-muted">Нет данных за период</Text>}
        {rows.map((r) => {
          const v = unit === "qty" ? r.qty ?? 0 : r.revenue
          return (
            <div key={r.key}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate text-ui-fg-base" title={r.key}>{r.key}</span>
                <span className="shrink-0 text-ui-fg-subtle">
                  {unit === "qty" ? `${r.qty} шт · ${rub(r.revenue)}` : `${rub(r.revenue)} · ${r.orders} зак.`}
                  {total ? ` · ${Math.round((v / total) * 100)}%` : ""}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-ui-bg-subtle">
                <div className="h-1.5 rounded-full bg-ui-fg-interactive" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </Container>
  )
}

/** Выручка по дням: столбики, при наведении — дата, заказы и сумма. */
function Daily({ rows }: { rows: Bucket[] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue))
  const label = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
  return (
    <Container className="p-0">
      <div className="px-6 py-4"><Heading level="h2">Выручка по дням</Heading></div>
      <div className="px-6 pb-5">
        <div className="flex h-40 items-end gap-[2px]">
          {rows.map((r) => (
            <div key={r.key} className="group relative flex h-full flex-1 items-end" title={`${label(r.key)}: ${r.orders} зак., ${rub(r.revenue)}`}>
              <div className="w-full rounded-t-sm bg-ui-fg-interactive opacity-80 group-hover:opacity-100" style={{ height: `${Math.max(r.revenue ? 2 : 0, (r.revenue / max) * 100)}%` }} />
            </div>
          ))}
        </div>
        {rows.length > 0 && (
          <div className="mt-2 flex justify-between text-xs text-ui-fg-muted">
            <span>{label(rows[0].key)}</span>
            <span>{label(rows[rows.length - 1].key)}</span>
          </div>
        )}
      </div>
    </Container>
  )
}

/** Статистика заказов сайта: выручка, средний чек, география, доставка, оплата, хиты, промокоды. */
const StatsPage = () => {
  const [from, setFrom] = useState(ago(29))
  const [to, setTo] = useState(ago(0))
  const [data, setData] = useState<Stats | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (f: string, t: string) => {
    setBusy(true)
    try {
      const r = await fetch(`/admin/stats?from=${f}&to=${t}`, { credentials: "include" })
      const d = await r.json()
      if (!r.ok) throw new Error((d as { message?: string }).message ?? "Не загрузилось")
      setData(d as Stats)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [])
  // Первая загрузка — за 30 дней; дальше по кнопкам
  const [first] = useState(() => ({ from, to }))
  useEffect(() => { load(first.from, first.to) }, [load, first])

  const pick = (f: string, t: string) => { setFrom(f); setTo(t); load(f, t) }
  const s = data?.summary
  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h1">Статистика</Heading>
          <Text size="small" className="text-ui-fg-subtle">Заказы сайта за период (по московскому времени). Отменённые в выручку не входят. Посещаемость и конверсия — в Яндекс Метрике.</Text>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-6 py-4">
          {presets().map((p) => (
            <Button key={p.label} size="small" variant={p.from === from && p.to === to ? "primary" : "secondary"} disabled={busy} onClick={() => pick(p.from, p.to)}>{p.label}</Button>
          ))}
          <div className="ml-auto flex items-end gap-2">
            <div><Label size="small" htmlFor="st-from">С</Label><Input id="st-from" type="date" size="small" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-36" /></div>
            <div><Label size="small" htmlFor="st-to">По</Label><Input id="st-to" type="date" size="small" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-36" /></div>
            <Button size="small" variant="secondary" isLoading={busy} onClick={() => load(from, to)}>Показать</Button>
          </div>
        </div>
      </Container>

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi title="Выручка" value={rub(s.revenue)} hint={<Delta now={s.revenue} prev={s.prev_revenue} />} />
            <Kpi title="Заказы" value={String(s.orders)} hint={<Delta now={s.orders} prev={s.prev_orders} />} />
            <Kpi title="Средний чек" value={rub(s.avg_check)} hint={<Delta now={s.avg_check} prev={s.prev_orders ? s.prev_revenue / s.prev_orders : 0} />} />
            <Kpi title="Товаров продано" value={`${s.items} шт`} />
            <Kpi title="Оплачено онлайн" value={`${s.paid_orders} из ${s.orders}`} />
            <Kpi title="Отменено" value={String(s.canceled)} />
            <Kpi title="Покупатели" value={`${s.new_customers + s.returning_customers}`} hint={<span className="text-xs text-ui-fg-subtle">новых {s.new_customers} · повторных {s.returning_customers}</span>} />
            <Kpi title="Скидки по заказам" value={rub(s.discount)} hint={<span className="text-xs text-ui-fg-subtle">промокоды и Laflamme Club</span>} />
          </div>
          <Daily rows={data.by_day} />
          <div className="grid gap-3 xl:grid-cols-2">
            <Bars title="Города" rows={data.cities} />
            <Bars title="Регионы" rows={data.regions} />
            <Bars title="Способы доставки" rows={data.delivery} />
            <Bars title="Способы оплаты" rows={data.payment} />
            <Bars title="Бренды" rows={data.brands} />
            <Bars title="Категории" rows={data.categories} />
            <Bars title="Хиты продаж" rows={data.products} unit="qty" />
            <Bars title="Промокоды (сумма скидки)" rows={data.promo} />
          </div>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "Статистика", icon: ChartBar })

export default StatsPage
