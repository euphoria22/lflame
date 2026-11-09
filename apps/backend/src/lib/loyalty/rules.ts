/**
 * Правила программы лояльности LAFLAMME (ТЗ, п. 6.7). Чистые функции без базы — их легко проверить тестами.
 */

export type Tier = { code: string; name: string; threshold: number; discount: number }

export type LoyaltySettings = {
  enabled: boolean
  tiers: Tier[]
  /** Период накопления, дней (скользящий) */
  period_days: number
  /** Онлайн-покупка засчитывается через N дней после получения */
  online_delay_days: number
  /** Офлайн-покупка — через N дней после чека */
  offline_delay_days: number
  /** За сколько дней предупреждать о понижении */
  warn_days: number
  /** Бренды, на которые скидка не действует (названия как на сайте) */
  excluded_brands: string[]
  /** Контрагенты МС, продажи которых не участвуют (часть названия): обезличенные, опт */
  excluded_counterparties: string[]
}

export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  tiers: [
    { code: "BASE", name: "BASE", threshold: 0, discount: 0 },
    { code: "MEMBER", name: "MEMBER", threshold: 50000, discount: 5 },
    { code: "SELECT", name: "SELECT", threshold: 100000, discount: 10 },
    { code: "ICON", name: "ICON", threshold: 200000, discount: 15 },
    { code: "PRIVATE", name: "PRIVATE", threshold: 400000, discount: 15 },
  ],
  period_days: 365,
  online_delay_days: 7,
  offline_delay_days: 0,
  warn_days: 30,
  excluded_brands: [],
  excluded_counterparties: ["Розничный покупатель", "Онлайн-заказ", "Самовывоз", "опт", "Опт", "B2B"],
}

const DAY = 86_400_000

/** Телефон РФ -> +7XXXXXXXXXX; null — не телефон. */
export function normalizePhone(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "")
  if (d.length === 11 && (d.startsWith("8") || d.startsWith("7"))) d = d.slice(1)
  if (d.length !== 10 || !d.startsWith("9")) return null
  return `+7${d}`
}

export function sortedTiers(tiers: Tier[]): Tier[] {
  return [...tiers].sort((a, b) => a.threshold - b.threshold)
}

export function tierFor(total: number, tiers: Tier[]): Tier {
  const list = sortedTiers(tiers)
  return list.filter((t) => total >= t.threshold).pop() ?? list[0]
}

export function nextTier(total: number, tiers: Tier[]): Tier | null {
  return sortedTiers(tiers).find((t) => t.threshold > total) ?? null
}

export type EntryLike = { amount: number; status: string; credit_at: Date | string; purchased_at: Date | string }

/** Засчитанная сумма за период на дату `now`: credited, засчитанные не раньше now − period. */
export function periodTotal(entries: EntryLike[], periodDays: number, now = new Date()): number {
  const from = now.getTime() - periodDays * DAY
  const sum = entries
    .filter((e) => e.status === "credited")
    .filter((e) => {
      const t = new Date(e.credit_at).getTime()
      return t <= now.getTime() && t > from
    })
    .reduce((s, e) => s + Number(e.amount), 0)
  return Math.max(0, Math.round(sum))
}

/**
 * Прогноз понижения: какой будет сумма через `warnDays` дней, если ничего не купить.
 * Возвращает уровень после выбывания и сколько нужно докупить, чтобы сохранить текущий.
 */
export function dropForecast(entries: EntryLike[], s: LoyaltySettings, now = new Date()) {
  const current = tierFor(periodTotal(entries, s.period_days, now), s.tiers)
  const at = new Date(now.getTime() + s.warn_days * DAY)
  const futureTotal = periodTotal(entries, s.period_days, at)
  const future = tierFor(futureTotal, s.tiers)
  if (future.threshold >= current.threshold) return null
  return { level: current, future, need: current.threshold - futureTotal, until: at }
}

/**
 * Цена со скидкой уровня по правилу «большая из двух» (не суммируются):
 * обычная цена (или «цена до скидки», если товар уценён) × (1 − скидка уровня), но не дороже текущей цены.
 */
export function loyaltyPrice(price: number, compareAt: number | null | undefined, discountPct: number): number {
  if (!discountPct) return price
  const base = compareAt && compareAt > price ? compareAt : price
  return Math.min(price, Math.round(base * (1 - discountPct / 100)))
}

export function isExcludedCounterparty(name: string | null | undefined, s: LoyaltySettings): boolean {
  const n = String(name ?? "")
  return s.excluded_counterparties.some((x) => x && n.includes(x))
}

export function validateLoyalty(input: Partial<LoyaltySettings>): { value?: LoyaltySettings; error?: string } {
  const v = { ...DEFAULT_LOYALTY, ...input }
  const tiers = (v.tiers ?? []).map((t) => ({
    code: String(t.code ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, ""),
    name: String(t.name ?? "").trim().slice(0, 40),
    threshold: Math.round(Number(t.threshold)),
    discount: Math.round(Number(t.discount) * 10) / 10,
  }))
  if (tiers.length < 1 || tiers.length > 10) return { error: "Уровней: от 1 до 10" }
  if (tiers.some((t) => !t.code || !t.name)) return { error: "У каждого уровня нужны код и название" }
  if (new Set(tiers.map((t) => t.code)).size !== tiers.length) return { error: "Коды уровней не должны повторяться" }
  if (tiers.some((t) => !Number.isFinite(t.threshold) || t.threshold < 0)) return { error: "Порог — сумма от 0 ₽" }
  if (tiers.some((t) => !Number.isFinite(t.discount) || t.discount < 0 || t.discount > 50)) return { error: "Скидка уровня — от 0 до 50%" }
  if (!tiers.some((t) => t.threshold === 0)) return { error: "Нужен начальный уровень с порогом 0 ₽" }
  const ints: [keyof LoyaltySettings, number, number][] = [["period_days", 30, 1095], ["online_delay_days", 0, 60], ["offline_delay_days", 0, 60], ["warn_days", 0, 120]]
  const out: LoyaltySettings = { ...v, tiers: sortedTiers(tiers), enabled: Boolean(v.enabled) }
  for (const [k, min, max] of ints) {
    const n = Math.round(Number(v[k]))
    if (!Number.isFinite(n) || n < min || n > max) return { error: `Значение «${k}»: от ${min} до ${max}` }
    ;(out[k] as number) = n
  }
  const list = (x: unknown) => (Array.isArray(x) ? x : String(x ?? "").split(/[,\n]/)).map((s) => String(s).trim()).filter(Boolean).slice(0, 200)
  out.excluded_brands = list(v.excluded_brands)
  out.excluded_counterparties = list(v.excluded_counterparties)
  return { value: out }
}
