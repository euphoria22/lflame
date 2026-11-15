import { MedusaContainer } from "@medusajs/framework/types"
import { loadCatalogItems } from "../catalog/store-catalog"
import { omskNow } from "../shifts/shifts"
import { Assign, capacityOf, zoneOf, ZoneLike } from "./autofill"
import { getLayout, listLayouts } from "./layouts"
import { TYPE_NAME } from "./names"
import { ROLE_NAME } from "./offline"
import { merchProducts } from "./products"
import { loadRetail, retailSummary } from "./retail"

/**
 * Отчёт эффективности выкладки (ТЗ, п. 3.12) по варианту расстановки (по умолчанию — текущему):
 * продажи магазина за 30 дней товаров, стоящих на оборудовании, на метр штанги / на место полки;
 * свод по зонам и брендам; сильные товары, не попавшие в зал; «второй шанс» — последние 14 дней против предыдущих.
 * Оговорка: продажа привязывается к месту, где товар стоит по расстановке сейчас, — это оценка.
 */
export async function merchReport(c: MedusaContainer, layoutId?: string) {
  const id = layoutId || (await listLayouts(c)).find((l) => l.is_current)?.id
  if (!id) throw new Error("Нет текущей расстановки")
  const layout = await getLayout(c, id)
  const data = layout.data as { items?: { id: string; type: string; label?: string; x: number; y: number; w: number; d: number; h: number }[]; zones?: (ZoneLike & { name: string })[]; assign?: Assign }
  const [rows, items, { products, source }] = await Promise.all([loadRetail(c), loadCatalogItems(c), merchProducts(c)])
  const sum = retailSummary(rows, omskNow().date)
  const ms = new Map(items.map((i) => [i.id, i.external_id ?? ""]))
  const brandOf = new Map(items.map((i) => [i.id, i.brand?.name ?? "—"]))
  const rev30 = new Map<string, { qty: number; rev: number }>()
  const today = Date.parse(`${omskNow().date}T00:00:00Z`)
  for (const r of rows) {
    if ((today - Date.parse(`${r.day}T00:00:00Z`)) / 86_400_000 > 30) continue
    const x = rev30.get(r.ms_product_id) ?? { qty: 0, rev: 0 }
    x.qty += r.qty
    x.rev += r.revenue
    rev30.set(r.ms_product_id, x)
  }
  const zones = data.zones ?? []
  const equipment = (data.items ?? []).map((it) => {
    const slots = data.assign?.[it.id] ?? []
    const cap = capacityOf(it)
    let qty = 0, rev = 0
    for (const s of slots) { const x = rev30.get(ms.get(s.p) ?? ""); if (x) { qty += x.qty; rev += x.rev } }
    const zone = zoneOf(it, zones) as (ZoneLike & { name: string }) | null
    const size = cap.railM > 0 ? cap.railM : cap.shelf
    return {
      id: it.id, name: it.label || TYPE_NAME[it.type] || it.type, zone: zone?.name ?? "—", models: slots.length,
      brands: [...new Set(slots.map((s) => brandOf.get(s.p) ?? "—"))],
      unit: cap.railM > 0 ? "м" : "место", size: Math.round(size * 10) / 10, qty, rev, per_unit: size > 0 ? Math.round(rev / size) : 0,
    }
  }).filter((e) => e.models > 0)
  const group = (key: (e: (typeof equipment)[number]) => string[]) => {
    const m = new Map<string, { qty: number; rev: number; equipment: number }>()
    for (const e of equipment) for (const k of key(e)) {
      const x = m.get(k) ?? { qty: 0, rev: 0, equipment: 0 }
      x.qty += e.qty / key(e).length
      x.rev += e.rev / key(e).length
      x.equipment++
      m.set(k, x)
    }
    return [...m.entries()].map(([name, x]) => ({ name, qty: Math.round(x.qty), rev: Math.round(x.rev), equipment: x.equipment })).sort((a, b) => b.rev - a.rev)
  }
  const placed = new Set(Object.values(data.assign ?? {}).flat().map((s) => s.p))
  const notInHall = products.filter((p) => !placed.has(p.id) && !p.outlet && p.role !== "offseason").sort((a, b) => b.score - a.score).slice(0, 20)
    .map((p) => ({ id: p.id, title: p.title, brand: p.brand, thumb: p.thumb, role: p.role ? ROLE_NAME[p.role] : null, q30: p.q30 ?? 0, score: p.score }))
  const second = products.filter((p) => p.role === "second_chance" && placed.has(p.id)).map((p) => {
    const s = sum.get(ms.get(p.id) ?? "")
    return { id: p.id, title: p.title, brand: p.brand, thumb: p.thumb, last14: s?.last14 ?? 0, prev14: s?.prev14 ?? 0, units: p.units }
  }).sort((a, b) => b.last14 - a.last14)
  const roles = Object.entries(products.reduce<Record<string, number>>((a, p) => { if (p.role) a[p.role] = (a[p.role] ?? 0) + 1; return a }, {}))
    .map(([r, n]) => ({ role: ROLE_NAME[r as keyof typeof ROLE_NAME] ?? r, n }))
  return {
    layout: { id, name: layout.name }, source, retail_days: new Set(rows.map((r) => r.day)).size,
    equipment: equipment.sort((a, b) => b.per_unit - a.per_unit), zones: group((e) => [e.zone]), brands: group((e) => e.brands),
    not_in_hall: notInHall, second_chance: second, roles,
  }
}
