import { container } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

/**
 * График смен магазина: кто в какой день работает (раздел «Смены» в админке),
 * напоминание в рабочий чат Telegram и команды бота /smena, /grafik (lib/shifts/bot.ts).
 * Хранится в metadata магазина: shifts — график и настройки, shifts_bot — служебное состояние бота.
 * Время — омское (UTC+6, без перехода на летнее).
 */

/** w — работает, o — выходной, ? — под вопросом, . — не заполнено */
export type DayStatus = "w" | "o" | "?" | "."
export const STATUSES: DayStatus[] = ["w", "o", "?", "."]

export type Person = { id: string; name: string; /** @username в Telegram — для упоминания в напоминании */ tg?: string }

export type Shifts = {
  people: Person[]
  /** "2026-11" → id сотрудника → строка из символов DayStatus по дням месяца */
  months: Record<string, Record<string, string>>
  chat_id: string
  chat_title: string
  remind_enabled: boolean
  /** Время напоминания, «ЧЧ:ММ» по Омску */
  remind_at: string
  /** Обычная смена: с какого и до какого часа («12:00», «21:00») */
  day_start: string
  day_end: string
  /** Неполные смены: "2026-11" → id сотрудника → число месяца → "12:00-18:00" (только в дни «работает») */
  hours: Record<string, Record<string, Record<string, string>>>
}

export type BotChat = { id: string; title: string; type: string; seen_at: string }
export type BotState = {
  offset: number
  chats: BotChat[]
  /** Дата (по Омску), за которую напоминание уже отправлено */
  last_sent: string
  poll_ok_at: string
  poll_error: string
}

const TZ_MS = 6 * 3600_000

/** Сегодняшняя дата и время по Омску: { date: "2026-11-16", time: "09:05" } */
export function omskNow(now = Date.now()) {
  const iso = new Date(now + TZ_MS).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 0 — понедельник … 6 — воскресенье */
export function weekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

const WD_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]
const WD_FULL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
export const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
const MONTHS_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"]

export const dayTitle = (date: string, full = false) =>
  `${(full ? WD_FULL : WD_SHORT)[weekday(date)]} ${Number(date.slice(8))} ${MONTHS_GEN[Number(date.slice(5, 7)) - 1]}`

/** Статус сотрудника в день */
export function statusOf(s: Shifts, personId: string, date: string): DayStatus {
  const row = s.months[date.slice(0, 7)]?.[personId] ?? ""
  const c = row[Number(date.slice(8)) - 1]
  return (STATUSES as string[]).includes(c) ? (c as DayStatus) : "."
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
/** Длина смены в часах (смена до полуночи) */
export const spanHours = (from: string, to: string) => Math.max(0, mins(to) - mins(from)) / 60
export const fullHours = (s: Shifts) => spanHours(s.day_start, s.day_end) || 1

/** Часы работы в день: обычная смена или неполная; null — не работает */
export function hoursOf(s: Shifts, personId: string, date: string): { from: string; to: string; partial: boolean } | null {
  if (statusOf(s, personId, date) !== "w") return null
  const custom = s.hours[date.slice(0, 7)]?.[personId]?.[String(Number(date.slice(8)))]
  if (custom) {
    const [from, to] = custom.split("-")
    return { from, to, partial: true }
  }
  return { from: s.day_start, to: s.day_end, partial: false }
}

/** Неполная смена — в скобках: «Иван (12:00–18:00)» */
const partialNote = (s: Shifts, p: Person, date: string) => {
  const h = hoursOf(s, p.id, date)
  return h?.partial ? ` (${h.from}–${h.to})` : ""
}

/** Кто работает в день и кто под вопросом */
export function dayCrew(s: Shifts, date: string) {
  return {
    work: s.people.filter((p) => statusOf(s, p.id, date) === "w"),
    maybe: s.people.filter((p) => statusOf(s, p.id, date) === "?"),
    filled: s.people.some((p) => statusOf(s, p.id, date) !== "."),
  }
}

// Текущий график, который был в таблице на момент запуска (ноябрь 2026) — чтобы не вводить заново
function seed(): Shifts {
  const weekdays = Array.from({ length: 30 }, (_, i) => (weekday(`2026-11-${String(i + 1).padStart(2, "0")}`) >= 5 ? "o" : "w")).join("")
  return {
    people: [{ id: "ivan", name: "Иван" }, { id: "maxim", name: "Максим" }, { id: "liza", name: "Лиза" }],
    months: { "2026-11": { ivan: "wowwoowwowwoowwowwoowwow???ww?", maxim: weekdays, liza: weekdays } },
    chat_id: "",
    chat_title: "",
    remind_enabled: false,
    remind_at: "09:00",
    day_start: "12:00",
    day_end: "21:00",
    hours: {},
  }
}

const DEFAULT_BOT: BotState = { offset: 0, chats: [], last_sent: "", poll_ok_at: "", poll_error: "" }

type StoreRow = { id: string; metadata?: Record<string, unknown> | null }
async function storeRow(): Promise<StoreRow> {
  const stores = (await container.resolve(Modules.STORE).listStores({}, { take: 1 })) as StoreRow[]
  if (!stores[0]) throw new Error("Магазин не найден")
  return stores[0]
}

/** Запись одного ключа metadata: перечитываем магазин прямо перед записью, чтобы не затереть соседние ключи */
async function writeMeta(key: string, value: unknown) {
  const s = await storeRow()
  await container.resolve(Modules.STORE).updateStores(s.id, { metadata: { ...(s.metadata ?? {}), [key]: value } })
}

export async function loadShifts(): Promise<Shifts> {
  const raw = (await storeRow()).metadata?.shifts as Partial<Shifts> | undefined
  if (!raw) return seed()
  return { ...seed(), people: [], months: {}, hours: {}, ...raw }
}

export async function loadBot(): Promise<BotState> {
  const raw = (await storeRow()).metadata?.shifts_bot as Partial<BotState> | undefined
  return { ...DEFAULT_BOT, ...(raw ?? {}) }
}

export async function patchBot(patch: Partial<BotState>): Promise<BotState> {
  const next = { ...(await loadBot()), ...patch }
  await writeMeta("shifts_bot", next)
  return next
}

/** Проверка и сохранение изменений из админки */
export async function saveShifts(patch: Partial<Shifts>): Promise<Shifts> {
  const cur = await loadShifts()
  const next: Shifts = { ...cur }
  if (patch.people) {
    const ids = new Set<string>()
    next.people = patch.people.map((p) => {
      const name = String(p.name ?? "").trim().slice(0, 40)
      if (!name) throw new Error("У сотрудника не указано имя")
      const id = String(p.id || "").trim() || `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      if (ids.has(id)) throw new Error("Повторяется сотрудник")
      ids.add(id)
      const tg = String(p.tg ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "")
      if (tg && !/^[A-Za-z0-9_]{4,32}$/.test(tg)) throw new Error(`Ник в Telegram «${tg}»: только латинские буквы, цифры и _`)
      return { id, name, ...(tg ? { tg } : {}) }
    })
  }
  if (patch.months) {
    const months = { ...cur.months }
    for (const [m, rows] of Object.entries(patch.months)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error("Неверный месяц")
      const n = daysInMonth(m)
      const clean: Record<string, string> = {}
      for (const [pid, row] of Object.entries(rows ?? {})) {
        const r = String(row ?? "").slice(0, n).padEnd(n, ".")
        if (![...r].every((c) => (STATUSES as string[]).includes(c))) throw new Error("Неверная отметка в графике")
        clean[pid] = r
      }
      months[m] = clean
    }
    // Старше года не храним
    const minKey = `${Number(omskNow().date.slice(0, 4)) - 1}${omskNow().date.slice(4, 7)}`
    next.months = Object.fromEntries(Object.entries(months).filter(([k]) => k >= minKey))
  }
  if (patch.day_start !== undefined || patch.day_end !== undefined) {
    const a = String(patch.day_start ?? cur.day_start), b = String(patch.day_end ?? cur.day_end)
    if (!TIME.test(a) || !TIME.test(b) || spanHours(a, b) <= 0) throw new Error("Обычная смена: время начала раньше конца, в виде 12:00")
    next.day_start = a
    next.day_end = b
  }
  if (patch.hours) {
    const hours = { ...cur.hours }
    for (const [m, byPerson] of Object.entries(patch.hours)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error("Неверный месяц")
      const row = next.months[m] ?? {}
      const clean: Record<string, Record<string, string>> = {}
      for (const [pid, days] of Object.entries(byPerson ?? {})) {
        for (const [d, range] of Object.entries(days ?? {})) {
          const [from, to] = String(range).split("-")
          if (!TIME.test(from ?? "") || !TIME.test(to ?? "") || spanHours(from, to) <= 0) throw new Error(`Неполная смена ${d} числа: укажите время «с» раньше, чем «до»`)
          // Часы храним только для дней «работает»
          if (row[pid]?.[Number(d) - 1] !== "w") continue
          ;(clean[pid] ??= {})[String(Number(d))] = `${from}-${to}`
        }
      }
      hours[m] = clean
    }
    next.hours = Object.fromEntries(Object.entries(hours).filter(([k]) => next.months[k]))
  }
  if (patch.chat_id !== undefined) {
    next.chat_id = String(patch.chat_id).trim()
    if (next.chat_id && !/^-?\d{1,20}$/.test(next.chat_id)) throw new Error("Неверный номер чата")
    next.chat_title = String(patch.chat_title ?? "").slice(0, 120)
  }
  if (patch.remind_enabled !== undefined) next.remind_enabled = !!patch.remind_enabled
  if (patch.remind_at !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(patch.remind_at))) throw new Error("Время напоминания — в виде 09:00")
    next.remind_at = String(patch.remind_at)
  }
  if (next.remind_enabled && !next.chat_id) throw new Error("Чтобы включить напоминания, выберите рабочий чат")
  await writeMeta("shifts", next)
  return next
}

// ── Тексты для Telegram (HTML) ──

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
const names = (ps: Person[], mention = false, s?: Shifts, date?: string) =>
  ps.map((p) => (mention && p.tg ? `${esc(p.name)} (@${p.tg})` : esc(p.name)) + (s && date ? partialNote(s, p, date) : "")).join(", ")

function crewLine(s: Shifts, date: string, mention = false) {
  const c = dayCrew(s, date)
  if (!c.filled) return "график не заполнен"
  let t = c.work.length ? names(c.work, mention, s, date) : "выходной у всех"
  if (c.maybe.length) t += ` · под вопросом: ${names(c.maybe)}`
  return t
}

/** Утреннее напоминание: кто сегодня, кто завтра */
export function reminderText(s: Shifts, today = omskNow().date) {
  const tomorrow = addDays(today, 1)
  return [
    `🗓 Сегодня, ${dayTitle(today, true)}`,
    `На смене: <b>${crewLine(s, today, true)}</b>`,
    "",
    `Завтра, ${dayTitle(tomorrow)}: ${crewLine(s, tomorrow)}`,
  ].join("\n")
}

/** /smena — сегодня и завтра */
export function todayText(s: Shifts, today = omskNow().date) {
  const tomorrow = addDays(today, 1)
  return [`Сегодня, ${dayTitle(today)}: <b>${crewLine(s, today)}</b>`, `Завтра, ${dayTitle(tomorrow)}: ${crewLine(s, tomorrow)}`].join("\n")
}

/** Сколько смен у каждого за месяц: неполная смена считается долей (6 часов из 9 — 0,67 смены), плюс часы */
export function monthCounts(s: Shifts, month: string) {
  const full = fullHours(s)
  return s.people.map((p) => {
    const row = s.months[month]?.[p.id] ?? ""
    let hours = 0
    ;[...row].forEach((c, i) => {
      if (c !== "w") return
      const h = hoursOf(s, p.id, `${month}-${String(i + 1).padStart(2, "0")}`)
      if (h) hours += spanHours(h.from, h.to)
    })
    return { person: p, work: Math.round((hours / full) * 10) / 10, hours: Math.round(hours * 10) / 10, maybe: [...row].filter((c) => c === "?").length }
  })
}

/** 20.7 → «20,7» */
export const num = (n: number) => String(n).replace(".", ",")

/**
 * /grafik — ближайшие 14 дней; /grafik mesyac (или «месяц», «весь») — весь текущий месяц;
 * /grafik next (или «след») — весь следующий месяц
 */
export function scheduleText(s: Shifts, mode: "two_weeks" | "month" | "next_month", today = omskNow().date) {
  let from = today
  let to = addDays(today, 13)
  let month = today.slice(0, 7)
  if (mode !== "two_weeks") {
    if (mode === "next_month") month = addDays(`${month}-01`, 32).slice(0, 7)
    from = `${month}-01`
    to = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`
  }
  const lines: string[] = []
  const title = mode === "two_weeks" ? "График смен на 2 недели" : `График смен · ${MONTHS_NOM[Number(month.slice(5)) - 1]}`
  lines.push(`<b>${title}</b>`)
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (weekday(d) === 0 && d !== from) lines.push("")
    const mark = d === today ? " ←" : ""
    lines.push(`${WD_SHORT[weekday(d)]} ${String(Number(d.slice(8))).padStart(2, " ")} — ${crewLine(s, d)}${mark}`)
  }
  if (mode !== "two_weeks") {
    const counts = monthCounts(s, month).map((c) => `${esc(c.person.name)} ${num(c.work)}${c.maybe ? ` (+${c.maybe}?)` : ""}`)
    if (counts.length) lines.push("", `Смен в ${MONTHS_PREP[Number(month.slice(5)) - 1]}: ${counts.join(", ")}`)
  }
  return lines.join("\n")
}

export const HELP_TEXT = [
  "<b>Команды графика смен</b>",
  "/smena — кто работает сегодня и завтра",
  "/grafik — график на 2 недели",
  "/grafik mesyac — весь месяц",
  "/grafik next — следующий месяц",
].join("\n")
