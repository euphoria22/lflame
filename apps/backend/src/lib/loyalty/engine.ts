import { container as rootContainer } from "@medusajs/framework"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../modules/loyalty"
import LoyaltyModuleService from "../../modules/loyalty/service"
import { MOYSKLAD_MODULE } from "../../modules/moysklad"
import MoyskladModuleService from "../../modules/moysklad/service"
import { sendMail } from "../notify/mailer"
import { loyaltyDropMail, loyaltyLevelMail } from "./mails"
import {
  DEFAULT_LOYALTY, dropForecast, EntryLike, isExcludedCounterparty, LoyaltySettings, nextTier, normalizePhone,
  periodTotal, sortedTiers, Tier, tierFor, validateLoyalty,
} from "./rules"

const DAY = 86_400_000

/* ---------- Настройки (store.metadata.loyalty_settings) ---------- */

type StoreRow = { id: string; metadata?: Record<string, unknown> | null }
let cache: { value: LoyaltySettings; at: number } | null = null

async function store(): Promise<StoreRow | null> {
  const rows = (await rootContainer.resolve(Modules.STORE).listStores({}, { take: 1 })) as StoreRow[]
  return rows[0] ?? null
}

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value
  try {
    const saved = ((await store())?.metadata?.loyalty_settings ?? {}) as Partial<LoyaltySettings>
    const value = { ...DEFAULT_LOYALTY, ...saved }
    cache = { value, at: Date.now() }
    return value
  } catch {
    return DEFAULT_LOYALTY
  }
}

export async function saveLoyaltySettings(input: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
  const { value, error } = validateLoyalty({ ...(await getLoyaltySettings()), ...input })
  if (error || !value) throw new MedusaError(MedusaError.Types.INVALID_DATA, error ?? "Неверные настройки")
  const s = await store()
  if (!s) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Магазин не найден")
  await rootContainer.resolve(Modules.STORE).updateStores(s.id, { metadata: { ...(s.metadata ?? {}), loyalty_settings: value } })
  cache = { value, at: Date.now() }
  return value
}

/* ---------- Журнал и участники ---------- */

type Entry = EntryLike & { id: string; phone: string; source: string; doc_type: string; doc_id: string; doc_name: string | null; note: string | null; created_at?: Date }
type Member = {
  id: string; phone: string; name: string | null; email: string | null; ms_counterparty_id: string | null
  total: number; level: string; level_override: string | null; override_reason: string | null
  warned_at: Date | null; warned_level: string | null; recalculated_at: Date | null
}

const svc = (c: MedusaContainer) => c.resolve<LoyaltyModuleService>(LOYALTY_MODULE)

export async function ensureMember(c: MedusaContainer, phone: string, info: { name?: string | null; email?: string | null; ms_counterparty_id?: string | null } = {}): Promise<Member> {
  const s = svc(c)
  const [m] = (await s.listLoyaltyMembers({ phone })) as unknown as Member[]
  const patch = Object.fromEntries(Object.entries(info).filter(([, v]) => v))
  if (m) {
    const changed = Object.entries(patch).some(([k, v]) => (m as Record<string, unknown>)[k] !== v)
    return changed ? ((await s.updateLoyaltyMembers({ id: m.id, ...patch })) as unknown as Member) : m
  }
  return (await s.createLoyaltyMembers({ phone, ...patch })) as unknown as Member
}

export type EntryInput = Omit<Entry, "id" | "status" | "created_at"> & { status?: "pending" | "credited" | "cancelled" }

/** Добавить или обновить запись журнала по doc_id. Отменённые и засчитанные онлайн-записи не перезаписываются. */
export async function upsertEntry(c: MedusaContainer, input: EntryInput): Promise<"created" | "updated" | "same"> {
  const s = svc(c)
  const [cur] = (await s.listLoyaltyEntries({ doc_id: input.doc_id })) as unknown as Entry[]
  if (!cur) {
    await s.createLoyaltyEntries({ ...input, status: input.status ?? "pending" } as never)
    return "created"
  }
  if (cur.status === "cancelled" && input.source === "online") return "same"
  const same = Number(cur.amount) === Number(input.amount) && cur.phone === input.phone && (input.status ?? cur.status) === cur.status
  if (same) return "same"
  await s.updateLoyaltyEntries({ id: cur.id, amount: input.amount, phone: input.phone, doc_name: input.doc_name, ...(input.status ? { status: input.status } : {}) } as never)
  return "updated"
}

/** Пересчёт участника: сумма за период, уровень, письмо о повышении. */
export async function recalcMember(c: MedusaContainer, phone: string, opts: { notify?: boolean } = {}): Promise<Member | null> {
  const s = svc(c)
  const settings = await getLoyaltySettings()
  const [m] = (await s.listLoyaltyMembers({ phone })) as unknown as Member[]
  if (!m) return null
  const entries = (await s.listLoyaltyEntries({ phone }, { take: 5000 })) as unknown as Entry[]
  const total = periodTotal(entries, settings.period_days)
  const calc = tierFor(total, settings.tiers)
  const level = m.level_override && settings.tiers.some((t) => t.code === m.level_override) ? m.level_override : calc.code
  const updated = (await s.updateLoyaltyMembers({ id: m.id, total, level, recalculated_at: new Date() })) as unknown as Member
  const rank = (code: string) => sortedTiers(settings.tiers).findIndex((t) => t.code === code)
  if (opts.notify !== false && m.email && rank(level) > rank(m.level)) {
    const tier = settings.tiers.find((t) => t.code === level)!
    await sendMail(loyaltyLevelMail(m.email, tier), c.resolve(ContainerRegistrationKeys.LOGGER)).catch(() => null)
  }
  return updated
}

/** Засчитать онлайн-покупки, у которых прошла задержка; пересчитать затронутых. */
export async function creditDue(c: MedusaContainer): Promise<number> {
  const s = svc(c)
  const due = (await s.listLoyaltyEntries({ status: "pending", credit_at: { $lte: new Date() } }, { take: 5000 })) as unknown as Entry[]
  for (const e of due) await s.updateLoyaltyEntries({ id: e.id, status: "credited" })
  for (const phone of new Set(due.map((e) => e.phone))) await recalcMember(c, phone)
  return due.length
}

/** Ночной пересчёт всех + предупреждения о понижении. */
export async function nightly(c: MedusaContainer): Promise<{ credited: number; members: number; warned: number }> {
  const logger = c.resolve(ContainerRegistrationKeys.LOGGER)
  const settings = await getLoyaltySettings()
  const credited = await creditDue(c)
  const s = svc(c)
  const members = (await s.listLoyaltyMembers({}, { take: 100000 })) as unknown as Member[]
  let warned = 0
  for (const m of members) {
    const after = await recalcMember(c, m.phone, { notify: true })
    if (!after?.email || !settings.warn_days) continue
    const entries = (await s.listLoyaltyEntries({ phone: m.phone }, { take: 5000 })) as unknown as Entry[]
    const f = dropForecast(entries, settings)
    if (!f) continue
    // Одно предупреждение на уровень в месяц
    if (after.warned_level === f.level.code && after.warned_at && Date.now() - new Date(after.warned_at).getTime() < 30 * DAY) continue
    await sendMail(loyaltyDropMail(after.email, f.level, f.need, f.until), logger).catch(() => null)
    await s.updateLoyaltyMembers({ id: m.id, warned_at: new Date(), warned_level: f.level.code })
    warned++
  }
  return { credited, members: members.length, warned }
}

/* ---------- Онлайн: заказы сайта ---------- */

type OrderRow = {
  id: string; display_id: number; email: string | null; created_at: string; status: string
  item_total: unknown; discount_total?: unknown
  shipping_address?: { phone?: string; first_name?: string; last_name?: string } | null
}

/** Заказ получен -> запись «ожидает зачёта» через N дней (ТЗ: зачёт через 7 дней после получения). */
export async function onOrderDelivered(c: MedusaContainer, orderId: string): Promise<void> {
  const settings = await getLoyaltySettings()
  if (!settings.enabled) return
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "created_at", "status", "item_total", "shipping_address.phone", "shipping_address.first_name", "shipping_address.last_name"],
    filters: { id: orderId },
  })
  const o = data[0] as unknown as OrderRow | undefined
  const phone = normalizePhone(o?.shipping_address?.phone)
  if (!o || !phone || o.status === "canceled") return
  const a = o.shipping_address ?? {}
  await ensureMember(c, phone, { name: [a.first_name, a.last_name].filter(Boolean).join(" ") || null, email: o.email })
  const now = new Date()
  await upsertEntry(c, {
    phone, source: "online", doc_type: "order", doc_id: `order:${o.id}`, doc_name: `Заказ сайта № ${o.display_id}`,
    amount: Math.round(Number(o.item_total)), purchased_at: new Date(o.created_at),
    credit_at: new Date(now.getTime() + settings.online_delay_days * DAY), note: null,
  })
  if (settings.online_delay_days === 0) await creditDue(c)
}

/** Заказ отменён / возвращён -> запись отменяется, уровень пересчитывается. */
export async function onOrderCanceled(c: MedusaContainer, orderId: string): Promise<void> {
  const s = svc(c)
  const [e] = (await s.listLoyaltyEntries({ doc_id: `order:${orderId}` })) as unknown as Entry[]
  if (!e || e.status === "cancelled") return
  await s.updateLoyaltyEntries({ id: e.id, status: "cancelled", note: "Заказ отменён" })
  await recalcMember(c, e.phone)
}

/* ---------- Офлайн: документы МоегоСклада ---------- */

type MsDoc = {
  id: string; name: string; moment: string; sum: number; updated: string
  agent?: { meta: { href: string } }
  customerOrder?: { externalCode?: string }
}
type MsCounterparty = { id: string; name: string; phone?: string; email?: string; companyType?: string }

const DOC_TYPES: { entity: string; sign: 1 | -1 }[] = [
  { entity: "retaildemand", sign: 1 },
  { entity: "demand", sign: 1 },
  { entity: "salesreturn", sign: -1 },
  { entity: "retailsalesreturn", sign: -1 },
]

const msDate = (d: Date) => d.toLocaleString("sv-SE", { timeZone: "Europe/Moscow" })

/**
 * Импорт продаж и возвратов из МС за период (по дате изменения документа).
 * Участвуют документы на контрагента с телефоном, кроме обезличенных (настройка).
 * Отгрузки по заказам сайта пропускаются — они уже учтены как онлайн-покупки.
 */
export async function importOffline(c: MedusaContainer, since: Date): Promise<{ docs: number; created: number; updated: number; skipped: number; members: number }> {
  const settings = await getLoyaltySettings()
  const ms = c.resolve<MoyskladModuleService>(MOYSKLAD_MODULE)
  const counterparties = new Map<string, MsCounterparty | null>()
  const touched = new Set<string>()
  const stat = { docs: 0, created: 0, updated: 0, skipped: 0, members: 0 }
  const periodStart = new Date(Date.now() - settings.period_days * DAY)

  async function agent(href: string): Promise<MsCounterparty | null> {
    const id = href.split("/").pop()!
    if (!counterparties.has(id)) {
      counterparties.set(id, await ms.api.get<MsCounterparty>(`entity/counterparty/${id}`).catch(() => null))
    }
    return counterparties.get(id) ?? null
  }

  for (const t of DOC_TYPES) {
    const rows = await ms.api.listAll<MsDoc>(`entity/${t.entity}`, {
      filter: `updated>=${msDate(since)}`,
      ...(t.entity === "demand" ? { expand: "customerOrder" } : {}),
    })
    for (const d of rows) {
      stat.docs++
      if (new Date(d.moment.replace(" ", "T") + "+03:00") < periodStart) { stat.skipped++; continue }
      // Отгрузка по заказу нашего сайта — уже есть онлайн-запись
      if (d.customerOrder?.externalCode?.startsWith("order_")) { stat.skipped++; continue }
      const cp = d.agent ? await agent(d.agent.meta.href) : null
      const phone = normalizePhone(cp?.phone)
      if (!cp || !phone || isExcludedCounterparty(cp.name, settings)) { stat.skipped++; continue }
      await ensureMember(c, phone, { name: cp.name, email: cp.email?.toLowerCase() ?? null, ms_counterparty_id: cp.id })
      const purchased = new Date(d.moment.replace(" ", "T") + "+03:00")
      const r = await upsertEntry(c, {
        phone, source: "offline", doc_type: t.entity, doc_id: `ms:${t.entity}:${d.id}`, doc_name: `${t.entity === "retaildemand" ? "Розничная продажа" : t.entity === "demand" ? "Отгрузка" : "Возврат"} № ${d.name}`,
        amount: Math.round((d.sum / 100) * t.sign), purchased_at: purchased,
        credit_at: new Date(purchased.getTime() + settings.offline_delay_days * DAY),
        status: settings.offline_delay_days === 0 || purchased.getTime() + settings.offline_delay_days * DAY <= Date.now() ? "credited" : "pending",
        note: null,
      })
      if (r === "created") stat.created++
      if (r === "updated") stat.updated++
      if (r !== "same") touched.add(phone)
    }
  }
  for (const phone of touched) await recalcMember(c, phone, { notify: false })
  stat.members = touched.size
  return stat
}

/* ---------- Ручная корректировка ---------- */

export async function manualAdjust(c: MedusaContainer, phoneRaw: string, amount: number, reason: string, by: string): Promise<Member | null> {
  const phone = normalizePhone(phoneRaw)
  if (!phone) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Неверный телефон")
  if (!reason.trim()) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Укажите причину")
  await ensureMember(c, phone)
  const now = new Date()
  await upsertEntry(c, {
    phone, source: "manual", doc_type: "manual", doc_id: `manual:${phone}:${now.getTime()}`, doc_name: "Корректировка",
    amount: Math.round(amount), purchased_at: now, credit_at: now, status: "credited", note: `${reason.trim()} (${by})`,
  })
  return recalcMember(c, phone)
}

export async function setOverride(c: MedusaContainer, phone: string, level: string | null, reason: string | null): Promise<Member | null> {
  const [m] = (await svc(c).listLoyaltyMembers({ phone })) as unknown as Member[]
  if (!m) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Участник не найден")
  await svc(c).updateLoyaltyMembers({ id: m.id, level_override: level, override_reason: level ? reason : null })
  return recalcMember(c, phone)
}

/* ---------- Статус для покупателя ---------- */

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
  /** Номер из профиля уже указан в другом аккаунте или в МС у другого email — уровень не показываем */
  taken?: boolean
}

/** Телефоны аккаунтов сайта (в любой записи) → email владельцев; обновляется раз в 5 минут */
let phoneOwners: { at: number; map: Map<string, Set<string>> } | null = null
async function accountsByPhone(c: MedusaContainer): Promise<Map<string, Set<string>>> {
  if (phoneOwners && Date.now() - phoneOwners.at < 5 * 60_000) return phoneOwners.map
  const list = (await c.resolve(Modules.CUSTOMER).listCustomers({ has_account: true }, { select: ["email", "phone"], take: 100000 })) as { email: string; phone?: string | null }[]
  const map = new Map<string, Set<string>>()
  for (const x of list) {
    const p = normalizePhone(x.phone)
    if (p) map.set(p, (map.get(p) ?? new Set()).add(x.email.toLowerCase()))
  }
  phoneOwners = { at: Date.now(), map }
  return map
}

/**
 * Номер из профиля — действительно этого покупателя (иначе по чужому номеру можно получить чужую скидку).
 * Подтверждён, если: был заказ на сайте с этим номером; или email в МоёмСкладе совпадает с email аккаунта;
 * или у покупателя из магазина в МС email не указан и этот номер не указан ни в одном другом аккаунте сайта.
 * Номер в любой записи: 8…, +7…, со скобками и пробелами.
 */
export async function phoneCheck(c: MedusaContainer, customer: { email: string; phone?: string | null }): Promise<{ phone: string | null; taken: boolean }> {
  const phone = normalizePhone(customer.phone)
  if (!phone) return { phone: null, taken: false }
  const email = customer.email.toLowerCase()
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "shipping_address.phone"], filters: { email: customer.email }, pagination: { take: 200 } })
  if ((data as { shipping_address?: { phone?: string } | null }[]).some((o) => normalizePhone(o.shipping_address?.phone) === phone)) return { phone, taken: false }
  const [m] = (await svc(c).listLoyaltyMembers({ phone })) as unknown as Member[]
  if (m?.email) return m.email.toLowerCase() === email ? { phone, taken: false } : { phone: null, taken: true }
  const others = [...((await accountsByPhone(c)).get(phone) ?? [])].filter((e) => e !== email)
  return others.length ? { phone: null, taken: true } : { phone, taken: false }
}

export async function confirmedPhone(c: MedusaContainer, customer: { email: string; phone?: string | null }): Promise<string | null> {
  return (await phoneCheck(c, customer)).phone
}

export async function statusFor(c: MedusaContainer, customer: { email: string; phone?: string | null }): Promise<LoyaltyStatus> {
  const settings = await getLoyaltySettings()
  const tiers = sortedTiers(settings.tiers)
  const empty: LoyaltyStatus = { enabled: settings.enabled, phone: normalizePhone(customer.phone), confirmed: false, level: tiers[0], total: 0, next: tiers[1] ?? null, to_next: tiers[1]?.threshold ?? 0, tiers, forecast: null, pending: 0, history: [] }
  const check = await phoneCheck(c, customer)
  const phone = check.phone
  if (!phone) return { ...empty, taken: check.taken }
  const [m] = (await svc(c).listLoyaltyMembers({ phone })) as unknown as Member[]
  const entries = (await svc(c).listLoyaltyEntries({ phone }, { take: 5000, order: { purchased_at: "DESC" } })) as unknown as Entry[]
  const total = periodTotal(entries, settings.period_days)
  const level = tiers.find((t) => t.code === m?.level) ?? tierFor(total, tiers)
  const next = nextTier(total, tiers)
  const f = dropForecast(entries, settings)
  return {
    enabled: settings.enabled, phone, confirmed: true, level, total, next, to_next: next ? next.threshold - total : 0, tiers,
    forecast: f ? { level: f.level.name, future: f.future.name, need: f.need, until: f.until.toISOString() } : null,
    pending: entries.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0),
    history: entries.filter((e) => e.status !== "cancelled").slice(0, 50).map((e) => ({
      date: new Date(e.purchased_at).toISOString(), title: e.doc_name ?? e.doc_type, amount: Number(e.amount), status: e.status, source: e.source,
    })),
  }
}

/** Скидка уровня для покупателя (0 — нет). */
export async function discountFor(c: MedusaContainer, customer: { email: string; phone?: string | null }): Promise<{ tier: Tier; pct: number } | null> {
  const settings = await getLoyaltySettings()
  if (!settings.enabled) return null
  const st = await statusFor(c, customer)
  return st.confirmed && st.level.discount > 0 ? { tier: st.level, pct: st.level.discount } : null
}

/* ---------- Отметка последнего импорта из МС ---------- */

export async function lastImportAt(): Promise<Date | null> {
  const v = (await store())?.metadata?.loyalty_imported_at
  return typeof v === "string" ? new Date(v) : null
}

export async function markImported(at: Date): Promise<void> {
  const s = await store()
  if (s) await rootContainer.resolve(Modules.STORE).updateStores(s.id, { metadata: { ...(s.metadata ?? {}), loyalty_imported_at: at.toISOString() } })
}

/** Импорт с прошлой отметки (с запасом 1 час); первый запуск — за весь период. */
export async function importSinceLast(c: MedusaContainer) {
  const settings = await getLoyaltySettings()
  const started = new Date()
  const last = await lastImportAt()
  const since = last ? new Date(last.getTime() - 3600_000) : new Date(Date.now() - settings.period_days * DAY)
  const r = await importOffline(c, since)
  await markImported(started)
  return { ...r, since: since.toISOString() }
}
