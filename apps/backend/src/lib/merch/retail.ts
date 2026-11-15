import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MERCH_MODULE } from "../../modules/merch"
import type MerchModuleService from "../../modules/merch/service"
import { MOYSKLAD_MODULE } from "../../modules/moysklad"
import type MoyskladModuleService from "../../modules/moysklad/service"
import { moyskladTime } from "../moysklad/context"
import { idFromHref } from "../moysklad/types"

/**
 * Продажи магазина для мерчендайзинга: только розничные чеки МоегоСклада (без сайта и отгрузок),
 * по дням (Омск) и размерам, за 60 дней. Пересчёт целиком раз в ночь (задача merch-retail).
 */

export const RETAIL_DAYS = 60

type Position = {
  quantity: number
  price?: number
  discount?: number
  assortment?: { meta: { href: string; type: string }; product?: { meta: { href: string } }; characteristics?: { name: string; value: string }[] }
}
type RetailDoc = { moment: string; positions?: { rows?: Position[]; meta?: { size: number; href: string } } }

/** «2026-11-15 14:03:22.000» по Москве → день по Омску (UTC+6) */
export function omskDay(moment: string): string {
  const utc = Date.parse(`${moment.replace(" ", "T").slice(0, 19)}+03:00`)
  return new Date(utc + 6 * 3600_000).toISOString().slice(0, 10)
}

export async function syncRetailSales(container: MedusaContainer) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ms = container.resolve<MoyskladModuleService>(MOYSKLAD_MODULE)
  if (!ms.api.isConfigured()) return { rows: 0, skipped: "МойСклад не подключён" }
  const svc = container.resolve<MerchModuleService>(MERCH_MODULE)
  const since = moyskladTime(new Date(Date.now() - RETAIL_DAYS * 86_400_000))
  const agg = new Map<string, { day: string; ms_product_id: string; size: string | null; qty: number; revenue: number }>()
  const add = (day: string, p: Position) => {
    const a = p.assortment
    if (!a) return
    const id = a.meta.type === "variant" ? idFromHref(a.product?.meta.href ?? "") : idFromHref(a.meta.href)
    if (!id) return
    const size = a.characteristics?.find((c) => c.name.toLowerCase() === "размер")?.value ?? a.characteristics?.[0]?.value ?? null
    const key = `${day}|${id}|${size ?? ""}`
    const row = agg.get(key) ?? { day, ms_product_id: id, size, qty: 0, revenue: 0 }
    row.qty += p.quantity || 0
    row.revenue += ((p.price ?? 0) / 100) * (p.quantity || 0) * (1 - (p.discount ?? 0) / 100)
    agg.set(key, row)
  }
  for (let offset = 0; ; offset += 100) {
    const page = await ms.api.get<{ rows: RetailDoc[]; meta: { size: number } }>("entity/retaildemand", {
      filter: `moment>=${since}`, expand: "positions.assortment", limit: 100, offset,
    })
    for (const doc of page.rows) {
      const day = omskDay(doc.moment)
      let rows = doc.positions?.rows ?? []
      if (doc.positions?.meta && doc.positions.meta.size > rows.length) {
        rows = await ms.api.listAll<Position>(doc.positions.meta.href.replace(/^.*\/api\/remap\/1\.2\//, ""), { expand: "assortment" })
      }
      rows.forEach((p) => add(day, p))
    }
    if (offset + 100 >= page.meta.size || !page.rows.length) break
  }
  // Возвраты вычитаем
  try {
    const returns = await ms.api.listAll<RetailDoc>("entity/retailsalesreturn", { filter: `moment>=${since}`, expand: "positions.assortment" })
    for (const doc of returns) for (const p of doc.positions?.rows ?? []) add(omskDay(doc.moment), { ...p, quantity: -(p.quantity || 0) })
  } catch (e) {
    log.warn(`Мерчендайзинг: возвраты не прочитаны (${(e as Error).message})`)
  }
  const old = (await svc.listMerchSales({}, { take: 1_000_000, select: ["id"] })) as { id: string }[]
  if (old.length) await svc.deleteMerchSales(old.map((r) => r.id))
  const rows = [...agg.values()].filter((r) => r.qty !== 0).map((r) => ({ ...r, qty: Math.round(r.qty), revenue: Math.round(r.revenue) }))
  for (let i = 0; i < rows.length; i += 500) await svc.createMerchSales(rows.slice(i, i + 500))
  log.info(`Мерчендайзинг: розничные продажи за ${RETAIL_DAYS} дней — ${rows.length} строк`)
  return { rows: rows.length }
}

export type RetailRow = { day: string; ms_product_id: string; size: string | null; qty: number; revenue: number }

export async function loadRetail(container: MedusaContainer): Promise<RetailRow[]> {
  const svc = container.resolve<MerchModuleService>(MERCH_MODULE)
  return (await svc.listMerchSales({}, { take: 1_000_000, select: ["day", "ms_product_id", "size", "qty", "revenue"] })) as unknown as RetailRow[]
}

/** Свод по товару МоегоСклада: за 30 и 60 дней, выручка, последние 14 и предыдущие 14 дней */
export function retailSummary(rows: RetailRow[], today: string) {
  const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`)
  const t = dayMs(today)
  const out = new Map<string, { q30: number; q60: number; rev60: number; last14: number; prev14: number }>()
  for (const r of rows) {
    const age = (t - dayMs(r.day)) / 86_400_000
    const s = out.get(r.ms_product_id) ?? { q30: 0, q60: 0, rev60: 0, last14: 0, prev14: 0 }
    if (age <= 60) { s.q60 += r.qty; s.rev60 += r.revenue }
    if (age <= 30) s.q30 += r.qty
    if (age <= 14) s.last14 += r.qty
    else if (age <= 28) s.prev14 += r.qty
    out.set(r.ms_product_id, s)
  }
  return out
}
