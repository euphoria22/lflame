/**
 * Расписание постов в канал: окно (например, 12:00–21:00 по Омску) и шаг (раз в 30 минут).
 * Слоты считаются от начала окна: 12:00, 12:30 … 21:00. Только расчёты — их проверяют тесты.
 */
export type TgSchedule = {
  /** Начало и конец окна, «ЧЧ:ММ» по часовому поясу tz; конец включительно */
  start: string
  end: string
  /** Шаг, минут */
  every: number
  /** Часовой пояс магазина */
  tz: string
  /** Очередь пуста — выложить лучшую рекомендацию */
  auto: boolean
  /** Выключено — посты не выходят, очередь ждёт */
  enabled: boolean
}

export const DEFAULT_SCHEDULE: TgSchedule = { start: "12:00", end: "21:00", every: 30, tz: "Asia/Omsk", auto: false, enabled: true }

const MIN = 60_000
const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m }
const HM = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateSchedule(input: Partial<TgSchedule>): { value?: TgSchedule; error?: string } {
  const v = { ...DEFAULT_SCHEDULE, ...input }
  if (!HM.test(v.start) || !HM.test(v.end)) return { error: "Время — в формате ЧЧ:ММ, например 12:00" }
  if (hm(v.end) < hm(v.start)) return { error: "Конец окна раньше начала" }
  if (!Number.isInteger(v.every) || v.every < 5 || v.every > 24 * 60) return { error: "Интервал — от 5 минут до суток" }
  try { new Intl.DateTimeFormat("ru-RU", { timeZone: v.tz }) } catch { return { error: "Неизвестный часовой пояс" } }
  return { value: { start: v.start, end: v.end, every: v.every, tz: v.tz, auto: Boolean(v.auto), enabled: v.enabled !== false } }
}

/** Смещение пояса от UTC в минутах на этот момент (Омск — всегда +6 ч) */
function offset(tz: string, at: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(at).map((p) => [p.type, p.value]))
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return Math.round((local - Math.floor(at.getTime() / MIN) * MIN) / MIN)
}

/** Слоты одного местного дня (полночь дня в UTC → слоты в UTC) */
function daySlots(s: TgSchedule, dayStartLocalMs: number, off: number): number[] {
  const out: number[] = []
  for (let m = hm(s.start); m <= hm(s.end); m += s.every) out.push(dayStartLocalMs + (m - off) * MIN)
  return out
}

/** Полночь местного дня, в который попадает момент at (в «местных» мс без пояса) */
function localMidnight(at: Date, off: number) {
  const local = at.getTime() + off * MIN
  return local - (((local % (1440 * MIN)) + 1440 * MIN) % (1440 * MIN))
}

/** Ближайшие count слотов не раньше from */
export function nextSlots(s: TgSchedule, from: Date, count: number): Date[] {
  const out: Date[] = []
  const off = offset(s.tz, from)
  for (let day = localMidnight(from, off); out.length < count && day < localMidnight(from, off) + 366 * 1440 * MIN; day += 1440 * MIN) {
    for (const t of daySlots(s, day, off)) if (t >= from.getTime() - MIN / 2 && out.length < count) out.push(new Date(t))
  }
  return out
}

/**
 * Пора ли выкладывать: последний слот, который уже наступил сегодня, ещё не отработан
 * и прошло не больше 10 минут (после простоя сервера пачку пропущенных постов не выкладываем).
 */
export function dueSlot(s: TgSchedule, now: Date, lastAt: string | null): Date | null {
  if (!s.enabled) return null
  const off = offset(s.tz, now)
  const passed = daySlots(s, localMidnight(now, off), off).filter((t) => t <= now.getTime())
  const slot = passed.at(-1)
  if (slot === undefined || now.getTime() - slot > 10 * MIN) return null
  if (lastAt && Date.parse(lastAt) >= slot) return null
  return new Date(slot)
}
