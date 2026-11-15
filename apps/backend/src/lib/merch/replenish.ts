import { MedusaContainer } from "@medusajs/framework/types"
import { loadCatalogItems } from "../catalog/store-catalog"
import { addDays, omskNow } from "../shifts/shifts"
import type { Assign } from "./autofill"
import { listLayouts, getLayout } from "./layouts"
import { loadRetail } from "./retail"
import { createPlainTask, Step } from "./tasks"
import { notifyCrew } from "./checklists"
import { TYPE_NAME } from "./names"

/**
 * Довешивание (ТЗ, п. 3.11): что продано в магазине вчера из того, что висит в зале по текущей расстановке, —
 * принести со склада тот же размер. Если размера больше нет — шаг подсказывает, что модель заменят при следующей раскладке.
 */
export async function buildReplenish(c: MedusaContainer, date = omskNow().date) {
  const yesterday = addDays(date, -1)
  const cur = (await listLayouts(c)).find((l) => l.is_current)
  if (!cur) return { steps: [] as Step[], layoutName: "" }
  const layout = await getLayout(c, cur.id)
  const data = layout.data as { items?: { id: string; type: string; label?: string; x: number; y: number }[]; assign?: Assign }
  const sold = (await loadRetail(c)).filter((r) => r.day === yesterday && r.qty > 0)
  if (!sold.length) return { steps: [], layoutName: layout.name }
  const items = await loadCatalogItems(c)
  const byMs = new Map(items.filter((i) => i.external_id).map((i) => [i.external_id!, i]))
  const soldBy = new Map<string, { sizes: string[]; qty: number }>()
  for (const r of sold) {
    const p = byMs.get(r.ms_product_id)
    if (!p) continue
    const x = soldBy.get(p.id) ?? { sizes: [], qty: 0 }
    x.qty += r.qty
    if (r.size) x.sizes.push(`${r.size}${r.qty > 1 ? ` ×${r.qty}` : ""}`)
    soldBy.set(p.id, x)
  }
  const byId = new Map(items.map((i) => [i.id, i]))
  const steps: Step[] = []
  for (const it of data.items ?? []) {
    const slots = (data.assign?.[it.id] ?? []).filter((s) => soldBy.has(s.p))
    if (!slots.length) continue
    const products = slots.map((s) => {
      const p = byId.get(s.p)!
      const left = p.sizes.filter((z) => z.in_stock).map((z) => z.size)
      return {
        id: p.id, title: p.title, brand: p.brand?.name ?? null, cat: p.category?.handle ?? null, color: p.color_name, thumb: p.thumbnail,
        // Показываем, какие размеры проданы; в наличии — для справки
        sizes: soldBy.get(s.p)!.sizes.length ? soldBy.get(s.p)!.sizes : [`продано ${soldBy.get(s.p)!.qty}`],
        n: soldBy.get(s.p)!.qty, place: s.place, left,
      }
    })
    steps.push({
      id: `s${steps.length + 1}`, item_id: it.id, title: it.label || TYPE_NAME[it.type] || "Оборудование", where: "", render: null,
      products: products.map(({ left: _l, ...p }) => p),
      remove: [],
      text: [
        "Вчера отсюда продали — принесите со склада те же размеры и повесьте на место модели.",
        ...products.filter((p) => !p.left.length).map((p) => `«${p.title}» закончилась — оставьте место, заменим при следующей раскладке.`),
      ],
      done_at: null, done_by: null, photos: [], comment: null, review: null,
    })
  }
  return { steps, layoutName: layout.name }
}

export async function sendReplenish(c: MedusaContainer, date = omskNow().date) {
  const { steps } = await buildReplenish(c, date)
  if (!steps.length) return { task: null, sent: false }
  const total = steps.reduce((a, s) => a + s.products.reduce((b, p) => b + p.n, 0), 0)
  const [d, m] = [Number(date.slice(8)), date.slice(5, 7)]
  const task = await createPlainTask(c, "checklist:replenish", `Довесить · ${d}.${m}`, steps)
  const sent = await notifyCrew("🧺", "Довесить проданное вчера", `${total} шт. на ${steps.length} местах — со склада те же размеры:`, task.token, date)
  return { task, sent }
}
