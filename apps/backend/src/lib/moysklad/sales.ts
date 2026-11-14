import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../../modules/moysklad"
import MoyskladModuleService from "../../modules/moysklad/service"
import { moyskladTime } from "./context"
import { idFromHref } from "./types"

/** За сколько дней считаются продажи для сортировки каталога (orders_30d в ТЗ сортировки) и рекомендаций Telegram. */
export const SALES_DAYS = 30

type Position = { quantity: number; assortment?: { meta: { href: string; type: string }; product?: { meta: { href: string } } } }
type SaleDoc = { positions?: { rows?: Position[]; meta?: { size: number; href: string } } }

/**
 * Продажи магазина из МоегоСклада за SALES_DAYS дней: розничные чеки (магазин в Омске) и отгрузки.
 * Только чтение. Нет прав на документ — этот источник пропускается, остальные считаются.
 */
async function storeSales(ms: MoyskladModuleService, log: { warn: (m: string) => void }): Promise<Map<string, number>> {
  const qty = new Map<string, number>()
  const since = moyskladTime(new Date(Date.now() - SALES_DAYS * 86400 * 1000))
  const add = (p: Position) => {
    const a = p.assortment
    if (!a) return
    // Модификация (размер) → её товар; товар без модификаций — он сам
    const id = a.meta.type === "variant" ? idFromHref(a.product?.meta.href ?? "") : idFromHref(a.meta.href)
    if (id) qty.set(id, (qty.get(id) ?? 0) + (p.quantity || 0))
  }
  for (const entity of ["retaildemand", "demand"]) {
    try {
      // С раскрытием позиций МС отдаёт не больше 100 документов за запрос
      for (let offset = 0; ; offset += 100) {
        const page = await ms.api.get<{ rows: SaleDoc[]; meta: { size: number } }>(`entity/${entity}`, {
          filter: `moment>=${since}`, expand: "positions.assortment", limit: 100, offset,
        })
        for (const doc of page.rows) {
          const rows = doc.positions?.rows ?? []
          rows.forEach(add)
          // В чеке больше позиций, чем вернулось раскрытыми, — догружаем отдельно
          if (doc.positions?.meta && doc.positions.meta.size > rows.length) {
            const all = await ms.api.listAll<Position>(doc.positions.meta.href.replace(/^.*\/api\/remap\/1\.2\//, ""), { expand: "assortment" })
            rows.forEach((p) => add({ ...p, quantity: -p.quantity })) // убрать уже учтённые
            all.forEach(add)
          }
        }
        if (offset + 100 >= page.meta.size || !page.rows.length) break
      }
    } catch (e) {
      log.warn(`Продажи: «${entity}» из МоегоСклада не прочитаны (${(e as Error).message}) — без них`)
    }
  }
  return qty
}

/** Заказы сайта за SALES_DAYS дней (без отменённых), по товару МоегоСклада (external_id). */
async function siteSales(container: MedusaContainer): Promise<Map<string, number>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const since = new Date(Date.now() - SALES_DAYS * 86400 * 1000)
  const qty = new Map<string, number>()
  const { data } = await query.graph({
    entity: "order",
    fields: ["status", "items.quantity", "items.product.external_id"],
    filters: { created_at: { $gte: since } },
    pagination: { take: 5000 },
  })
  for (const o of data as { status: string; items?: { quantity: number; product?: { external_id?: string | null } | null }[] }[]) {
    if (o.status === "canceled") continue
    for (const i of o.items ?? []) {
      const id = i.product?.external_id
      if (id) qty.set(id, (qty.get(id) ?? 0) + Number(i.quantity || 0))
    }
  }
  return qty
}

/** Пересчёт продаж для сортировки: раз в сутки (job) или вручную (скрипт). */
export async function refreshSales(container: MedusaContainer): Promise<{ products: number; store_total: number; site_total: number }> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  const store = ms.api.isConfigured() ? await storeSales(ms, logger) : new Map<string, number>()
  const site = await siteSales(container)

  const ids = new Set([...store.keys(), ...site.keys()])
  const existing = await ms.listMoyskladProductSales({}, { take: 100000 })
  const byId = new Map(existing.map((r) => [r.moysklad_product_id, r]))
  const toCreate: { moysklad_product_id: string; store_qty: number; site_qty: number }[] = []
  const toUpdate: { id: string; store_qty: number; site_qty: number }[] = []
  for (const id of ids) {
    const row = { store_qty: Math.max(0, Math.round(store.get(id) ?? 0)), site_qty: Math.max(0, Math.round(site.get(id) ?? 0)) }
    const ex = byId.get(id)
    if (ex) toUpdate.push({ id: ex.id, ...row })
    else toCreate.push({ moysklad_product_id: id, ...row })
  }
  // Продаж больше нет — обнуляем, чтобы товар не висел наверху по старым данным
  for (const ex of existing) if (!ids.has(ex.moysklad_product_id) && (ex.store_qty || ex.site_qty)) toUpdate.push({ id: ex.id, store_qty: 0, site_qty: 0 })
  if (toCreate.length) await ms.createMoyskladProductSales(toCreate)
  if (toUpdate.length) await ms.updateMoyskladProductSales(toUpdate)

  const result = {
    products: ids.size,
    store_total: [...store.values()].reduce((a, b) => a + b, 0),
    site_total: [...site.values()].reduce((a, b) => a + b, 0),
  }
  logger.info(`Продажи для сортировки: ${JSON.stringify(result)}`)
  return result
}

/** Продажи по товару МоегоСклада: магазин + сайт (заказ сайта весит вдвое: это прямой сигнал для витрины). */
export async function salesByMoyskladId(container: MedusaContainer): Promise<Map<string, number>> {
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  const rows = await ms.listMoyskladProductSales({}, { take: 100000 })
  return new Map(rows.map((r) => [r.moysklad_product_id, r.store_qty + 2 * r.site_qty]))
}

/** Продано штук по товару МоегоСклада: сайт и розница вместе, без весов (orders_30d) */
export async function salesUnitsByMoyskladId(container: MedusaContainer): Promise<Map<string, number>> {
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  const rows = await ms.listMoyskladProductSales({}, { take: 100000 })
  return new Map(rows.map((r) => [r.moysklad_product_id, r.store_qty + r.site_qty]))
}
