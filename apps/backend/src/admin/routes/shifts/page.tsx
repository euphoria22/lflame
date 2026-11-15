import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CalendarSolid, ChevronLeft, ChevronRight, Trash } from "@medusajs/icons"
import { Badge, Button, Container, Heading, IconButton, Input, Label, Select, Switch, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type Status = "w" | "o" | "?" | "."
type Person = { id: string; name: string; tg?: string }
type Hours = Record<string, Record<string, string>>
type Shifts = {
  people: Person[]; months: Record<string, Record<string, string>>; chat_id: string; chat_title: string; remind_enabled: boolean; remind_at: string
  day_start: string; day_end: string; hours: Record<string, Hours>
}
type BotChat = { id: string; title: string; type: string }
type Resp = { shifts: Shifts; today: string; bot: { configured: boolean; ok_at: string | null; error: string | null; last_sent: string | null; chats: BotChat[] } }

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
const WD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]
const daysIn = (m: string) => { const [y, mm] = m.split("-").map(Number); return new Date(Date.UTC(y, mm, 0)).getUTCDate() }
const wdOf = (m: string, d: number) => (new Date(`${m}-${String(d).padStart(2, "0")}T00:00:00Z`).getUTCDay() + 6) % 7
const shiftMonth = (m: string, n: number) => { const [y, mm] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mm - 1 + n, 1)); return d.toISOString().slice(0, 7) }

// Цвета как в таблице: зелёный — работает, красный — выходной
const CELL: Record<Status, { bg: string; fg: string; label: string }> = {
  w: { bg: "#22c55e", fg: "#052e16", label: "Работает" },
  o: { bg: "#ef4444", fg: "#450a0a", label: "Выходной" },
  "?": { bg: "#fde68a", fg: "#713f12", label: "Под вопросом" },
  ".": { bg: "transparent", fg: "inherit", label: "Стереть" },
}
// Неполная смена — светло-зелёная, в клетке число часов
const PARTIAL = { bg: "#a7f3c0", fg: "#052e16" }
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const span = (from: string, to: string) => Math.max(0, mins(to) - mins(from)) / 60
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",")

const api = async (path: string, body?: unknown) => {
  const r = await fetch(`/admin/shifts${path}`, {
    method: body === undefined ? "GET" : "POST", credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message ?? `Ошибка (ответ сервера ${r.status})`)
  return d
}

/**
 * Таблица месяца: выбираете «кисть» и закрашиваете клетки (можно провести мышкой по нескольким).
 * «Неполная» — рабочий день с другими часами (ушёл раньше, сокращённый день): в подсчёте — доля смены.
 */
type Brush = Status | "p"
const Grid = ({ data, today, onSaved }: { data: Shifts; today: string; onSaved: () => void }) => {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [brush, setBrush] = useState<Brush>("w")
  const [pFrom, setPFrom] = useState(data.day_start)
  const [pTo, setPTo] = useState("18:00")
  const [rows, setRows] = useState<Record<string, string>>({})
  const [hours, setHours] = useState<Hours>({})
  const [busy, setBusy] = useState(false)
  const painting = useRef(false)
  const n = daysIn(month)
  const full = span(data.day_start, data.day_end) || 1
  const saved = useMemo(() => {
    const r: Record<string, string> = {}
    for (const p of data.people) r[p.id] = (data.months[month]?.[p.id] ?? "").padEnd(n, ".").slice(0, n)
    return { rows: r, hours: data.hours?.[month] ?? {} }
  }, [data, month, n])
  useEffect(() => { setRows(saved.rows); setHours(saved.hours) }, [saved])
  useEffect(() => {
    const up = () => { painting.current = false }
    window.addEventListener("mouseup", up)
    return () => window.removeEventListener("mouseup", up)
  }, [])
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved.rows) || JSON.stringify(hours) !== JSON.stringify(saved.hours)
  const partialOk = span(pFrom, pTo) > 0
  const setDay = (pid: string, d: number, st: Status, range: string | null) => {
    setRows((r) => {
      const row = (r[pid] ?? "".padEnd(n, ".")).split("")
      row[d - 1] = st
      return { ...r, [pid]: row.join("") }
    })
    setHours((h) => {
      const days = { ...(h[pid] ?? {}) }
      if (range) days[String(d)] = range
      else delete days[String(d)]
      return { ...h, [pid]: days }
    })
  }
  const paint = (pid: string, d: number) => {
    if (brush === "p") {
      if (partialOk) setDay(pid, d, "w", `${pFrom}-${pTo}`)
    } else setDay(pid, d, brush, null)
  }
  const fillRow = (pid: string) => { for (let d = 1; d <= n; d++) paint(pid, d) }
  const go = (k: number) => {
    if (dirty && !window.confirm("Изменения в этом месяце не сохранены. Перейти без сохранения?")) return
    setMonth(shiftMonth(month, k))
  }
  const save = async () => {
    setBusy(true)
    try {
      await api("", { months: { [month]: rows }, hours: { [month]: hours } })
      toast.success("График сохранён")
      onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const days = Array.from({ length: n }, (_, i) => i + 1)
  const isToday = (d: number) => `${month}-${String(d).padStart(2, "0")}` === today
  const brushes: { id: Brush; bg: string; fg: string; label: string; mark?: string }[] = [
    { id: "w", ...CELL.w },
    { id: "p", ...PARTIAL, label: "Неполная", mark: "ч" },
    { id: "o", ...CELL.o },
    { id: "?", ...CELL["?"], mark: "?" },
    { id: ".", ...CELL["."] },
  ]

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h2">График смен</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Выберите отметку и нажимайте на клетки — или проведите мышкой по нескольким дням. Затем «Сохранить».
            Обычная смена — с {data.day_start} до {data.day_end}; «Неполная» — если человек ушёл раньше или день сокращённый.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <IconButton size="small" variant="transparent" onClick={() => go(-1)}><ChevronLeft /></IconButton>
          <Text weight="plus" className="w-36 text-center">{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</Text>
          <IconButton size="small" variant="transparent" onClick={() => go(1)}><ChevronRight /></IconButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        {brushes.map((b) => (
          <button key={b.id} type="button" onClick={() => setBrush(b.id)}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${brush === b.id ? "border-ui-fg-base" : "border-ui-border-base text-ui-fg-subtle"}`}>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-ui-border-base text-[10px] font-semibold" style={{ background: b.bg, color: b.fg }}>{b.mark ?? ""}</span>
            {b.label}
          </button>
        ))}
        {brush === "p" && (
          <div className="flex items-center gap-2">
            <Text size="small" className="text-ui-fg-subtle">с</Text>
            <Input type="time" size="small" className="w-28" value={pFrom} onChange={(e) => setPFrom(e.target.value)} />
            <Text size="small" className="text-ui-fg-subtle">до</Text>
            <Input type="time" size="small" className="w-28" value={pTo} onChange={(e) => setPTo(e.target.value)} />
            <Text size="small" className={partialOk ? "text-ui-fg-subtle" : "text-ui-fg-error"}>{partialOk ? `${fmt(span(pFrom, pTo))} ч = ${fmt(span(pFrom, pTo) / full)} смены` : "«с» должно быть раньше «до»"}</Text>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {dirty && <Button size="small" variant="secondary" onClick={() => { setRows(saved.rows); setHours(saved.hours) }}>Отменить</Button>}
          <Button size="small" disabled={!dirty} isLoading={busy} onClick={save}>Сохранить</Button>
        </div>
      </div>
      <div className="overflow-x-auto px-6 py-4 select-none">
        {data.people.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">Добавьте сотрудников ниже.</Text>
        ) : (
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="min-w-28 pr-3 text-left font-medium" />
                {days.map((d) => (
                  <th key={d} className={`w-8 min-w-8 pb-1 text-center font-normal ${wdOf(month, d) >= 5 ? "text-ui-fg-error" : "text-ui-fg-subtle"}`}>
                    <div className={`text-xs ${isToday(d) ? "font-semibold text-ui-fg-base underline" : ""}`}>{d}</div>
                    <div className="text-[10px]">{WD[wdOf(month, d)]}</div>
                  </th>
                ))}
                <th className="pl-3 text-left text-xs font-normal text-ui-fg-subtle">смен</th>
                <th className="pl-3 text-left text-xs font-normal text-ui-fg-subtle">часов</th>
              </tr>
            </thead>
            <tbody>
              {data.people.map((p) => {
                const row = rows[p.id] ?? "".padEnd(n, ".")
                let total = 0
                const cells = days.map((d) => {
                  const c = (row[d - 1] ?? ".") as Status
                  const range = c === "w" ? hours[p.id]?.[String(d)] : undefined
                  const [from, to] = range ? range.split("-") : [data.day_start, data.day_end]
                  const h = c === "w" ? span(from, to) : 0
                  total += h
                  return { d, c, range, h }
                })
                const maybe = [...row].filter((c) => c === "?").length
                return (
                  <tr key={p.id}>
                    <td className="pr-3">
                      <button type="button" title="Закрасить весь месяц выбранной отметкой" onClick={() => fillRow(p.id)} className="text-left hover:underline">{p.name}</button>
                    </td>
                    {cells.map(({ d, c, range, h }) => {
                      const look = range ? PARTIAL : CELL[c]
                      return (
                        <td key={d}
                          title={range ? `${range.replace("-", "–")} (${fmt(h)} ч)` : undefined}
                          onMouseDown={(e) => { e.preventDefault(); painting.current = true; paint(p.id, d) }}
                          onMouseEnter={() => { if (painting.current) paint(p.id, d) }}
                          className={`h-8 cursor-pointer border border-black/20 text-center text-xs font-semibold ${isToday(d) ? "outline outline-2 -outline-offset-2 outline-ui-fg-base" : ""}`}
                          style={{ background: look.bg, color: look.fg }}>
                          {range ? fmt(h) : c === "?" ? "?" : ""}
                        </td>
                      )
                    })}
                    <td className="pl-3 text-sm tabular-nums">{fmt(total / full)}{maybe ? <span className="text-ui-fg-subtle"> +{maybe}?</span> : null}</td>
                    <td className="pl-3 text-sm tabular-nums text-ui-fg-subtle">{fmt(total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Container>
  )
}

/** Сотрудники: имя и ник в Telegram (для упоминания в утреннем напоминании) */
const People = ({ data, onSaved }: { data: Shifts; onSaved: () => void }) => {
  const [list, setList] = useState<Person[]>(data.people)
  const [day, setDay] = useState({ day_start: data.day_start, day_end: data.day_end })
  const [busy, setBusy] = useState(false)
  useEffect(() => { setList(data.people) }, [data.people])
  useEffect(() => { setDay({ day_start: data.day_start, day_end: data.day_end }) }, [data.day_start, data.day_end])
  const dirty = JSON.stringify(list) !== JSON.stringify(data.people) || day.day_start !== data.day_start || day.day_end !== data.day_end
  const set = (i: number, patch: Partial<Person>) => setList((l) => l.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const save = async () => {
    setBusy(true)
    try {
      await api("", { people: list, ...day })
      toast.success("Сохранено")
      onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Сотрудники и смена</Heading>
        <Text size="small" className="text-ui-fg-subtle">Ник в Telegram — необязательно: тогда в утреннем напоминании человек будет упомянут и получит уведомление.</Text>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <Label size="small">Обычная смена</Label>
        <Text size="small" className="text-ui-fg-subtle">с</Text>
        <Input type="time" size="small" className="w-28" value={day.day_start} onChange={(e) => setDay({ ...day, day_start: e.target.value })} />
        <Text size="small" className="text-ui-fg-subtle">до</Text>
        <Input type="time" size="small" className="w-28" value={day.day_end} onChange={(e) => setDay({ ...day, day_end: e.target.value })} />
        <Text size="small" className="text-ui-fg-subtle">— {fmt(span(day.day_start, day.day_end))} ч; неполная смена считается долей от неё</Text>
      </div>
      <div className="flex flex-col gap-2 px-6 py-4">
        {list.map((p, i) => (
          <div key={p.id || i} className="flex items-center gap-2">
            <Input className="w-48" placeholder="Имя" value={p.name} onChange={(e) => set(i, { name: e.target.value })} />
            <Input className="w-56" placeholder="@ник в Telegram" value={p.tg ? `@${p.tg.replace(/^@/, "")}` : ""} onChange={(e) => set(i, { tg: e.target.value.replace(/^@/, "") })} />
            <IconButton size="small" variant="transparent" title="Удалить" onClick={() => {
              if (window.confirm(`Удалить «${p.name || "сотрудника"}» из графика? Его отметки в таблице пропадут.`)) setList((l) => l.filter((_, j) => j !== i))
            }}><Trash /></IconButton>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Button size="small" variant="secondary" onClick={() => setList((l) => [...l, { id: "", name: "" }])}>Добавить сотрудника</Button>
          <Button size="small" disabled={!dirty} isLoading={busy} onClick={save}>Сохранить</Button>
        </div>
      </div>
    </Container>
  )
}

/** Напоминание в рабочий чат и команды бота */
const Reminder = ({ resp, onSaved }: { resp: Resp; onSaved: () => void }) => {
  const { shifts, bot } = resp
  const [v, setV] = useState({ chat_id: shifts.chat_id, remind_enabled: shifts.remind_enabled, remind_at: shifts.remind_at })
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { setV({ chat_id: shifts.chat_id, remind_enabled: shifts.remind_enabled, remind_at: shifts.remind_at }) }, [shifts.chat_id, shifts.remind_enabled, shifts.remind_at])
  const dirty = v.chat_id !== shifts.chat_id || v.remind_enabled !== shifts.remind_enabled || v.remind_at !== shifts.remind_at
  // Чаты, где есть бот (группы — первыми), плюс уже выбранный, даже если его нет в списке
  const chats = useMemo(() => {
    const list = [...bot.chats].sort((a, b) => Number(a.type === "private") - Number(b.type === "private"))
    if (shifts.chat_id && !list.some((c) => c.id === shifts.chat_id)) list.unshift({ id: shifts.chat_id, title: shifts.chat_title || shifts.chat_id, type: "group" })
    return list
  }, [bot.chats, shifts.chat_id, shifts.chat_title])
  const save = async () => {
    setBusy("save")
    try {
      const title = chats.find((c) => c.id === v.chat_id)?.title ?? ""
      await api("", { ...v, chat_title: title })
      toast.success("Сохранено")
      onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const sendNow = async () => {
    setBusy("send")
    try {
      await api("/remind", {})
      toast.success("Напоминание отправлено в чат")
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const status = !bot.configured
    ? <Badge size="2xsmall" color="grey">бот Telegram не настроен на сервере</Badge>
    : bot.error
      ? <Badge size="2xsmall" color="red">бот не получает сообщения</Badge>
      : bot.ok_at && Date.now() - Date.parse(bot.ok_at) < 30 * 60_000
        ? <Badge size="2xsmall" color="green">бот на связи</Badge>
        : <Badge size="2xsmall" color="orange">бот ещё не выходил на связь</Badge>
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <div className="flex items-center gap-3"><Heading level="h2">Напоминания в Telegram</Heading>{status}</div>
        <Text size="small" className="text-ui-fg-subtle">Каждый день в заданное время (по Омску) бот пишет в рабочий чат, кто сегодня и завтра на смене. В чате работают команды: /smena — кто сегодня и завтра, /grafik — на 2 недели, /grafik mesyac — весь месяц, /grafik next — следующий месяц.</Text>
        {bot.error && <Text size="small" className="mt-2 text-ui-fg-error">{bot.error}</Text>}
      </div>
      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <Label size="small">Рабочий чат</Label>
          {chats.length ? (
            <Select value={v.chat_id || undefined} onValueChange={(id) => setV({ ...v, chat_id: id })}>
              <Select.Trigger className="w-96"><Select.Value placeholder="Выберите чат" /></Select.Trigger>
              <Select.Content>
                {chats.map((c) => <Select.Item key={c.id} value={c.id}>{c.title}{c.type === "private" ? " (личный)" : ""}</Select.Item>)}
              </Select.Content>
            </Select>
          ) : null}
          <Text size="small" className="text-ui-fg-subtle">
            Чтобы чат появился в списке: добавьте бота магазина в рабочий чат и напишите там /smena, затем обновите страницу (до минуты).
          </Text>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={v.remind_enabled} onCheckedChange={(c) => setV({ ...v, remind_enabled: c })} />
            <Label size="small">Присылать напоминание каждый день</Label>
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Время (Омск)</Label>
            <Input type="time" className="w-32" value={v.remind_at} onChange={(e) => setV({ ...v, remind_at: e.target.value })} />
          </div>
          <Button size="small" disabled={!dirty} isLoading={busy === "save"} onClick={save}>Сохранить</Button>
          <Button size="small" variant="secondary" disabled={!shifts.chat_id || dirty} isLoading={busy === "send"} onClick={sendNow}>Отправить напоминание сейчас</Button>
        </div>
      </div>
    </Container>
  )
}

const ShiftsPage = () => {
  const [resp, setResp] = useState<Resp | null>(null)
  const load = useCallback(() => {
    api("").then(setResp).catch((e: Error) => toast.error(e.message))
  }, [])
  useEffect(() => { load() }, [load])
  if (!resp) return <Container><Text>Загрузка…</Text></Container>
  return (
    <div className="flex flex-col gap-4">
      <Grid data={resp.shifts} today={resp.today} onSaved={load} />
      <Reminder resp={resp} onSaved={load} />
      <People data={resp.shifts} onSaved={load} />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Смены",
  icon: CalendarSolid,
})

export default ShiftsPage
