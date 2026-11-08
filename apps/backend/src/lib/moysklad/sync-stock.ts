import { batchInventoryItemLevelsWorkflow } from "@medusajs/medusa/core-flows"
import { SyncContext } from "./context"

type LevelRow = { id: string; location_id: string; stocked_quantity: number; reserved_quantity: number }
type VariantRow = {
  id: string
  metadata?: Record<string, unknown> | null
  inventory_items?: { inventory_item_id: string; inventory?: { location_levels?: LevelRow[] } }[]
}

export type StockSyncStats = { variants: number; created: number; updated: number; unchanged: number; unknown: number }

/**
 * Переносит свободные остатки МС в Medusa (ТЗ, п. 3.3).
 *
 * В Medusa «доступно» = stocked_quantity − reserved_quantity. Резерв Medusa — это заказы сайта,
 * которые в МС уже учтены в свободном остатке (п. 3.4). Поэтому
 * stocked_quantity = свободный остаток МС + резерв Medusa, и доступно = свободный остаток МС.
 */
export async function syncStockLevels(
  ctx: SyncContext,
  freeStock: Map<string, number>,
  onlyVariantIds?: string[]
): Promise<StockSyncStats> {
  const stats: StockSyncStats = { variants: 0, created: 0, updated: 0, unchanged: 0, unknown: 0 }
  const create: { inventory_item_id: string; location_id: string; stocked_quantity: number }[] = []
  const update: { id: string; inventory_item_id: string; location_id: string; stocked_quantity: number }[] = []

  const take = 1000
  for (let skip = 0; ; skip += take) {
    const { data } = await ctx.query.graph({
      entity: "product_variant",
      fields: [
        "id",
        "metadata",
        "inventory_items.inventory_item_id",
        "inventory_items.inventory.location_levels.id",
        "inventory_items.inventory.location_levels.location_id",
        "inventory_items.inventory.location_levels.stocked_quantity",
        "inventory_items.inventory.location_levels.reserved_quantity",
      ],
      filters: onlyVariantIds ? { id: onlyVariantIds.slice(skip, skip + take) } : {},
      pagination: onlyVariantIds ? undefined : { take, skip },
    })
    const rows = data as VariantRow[]

    for (const v of rows) {
      const msId = v.metadata?.moysklad_id as string | undefined
      const item = v.inventory_items?.[0]
      if (!msId || !item) {
        stats.unknown++
        continue
      }
      stats.variants++
      const free = Math.max(0, Math.floor(freeStock.get(msId) ?? 0))
      const level = item.inventory?.location_levels?.find((l) => l.location_id === ctx.locationId)
      if (!level) {
        create.push({ inventory_item_id: item.inventory_item_id, location_id: ctx.locationId, stocked_quantity: free })
        continue
      }
      const desired = free + (level.reserved_quantity ?? 0)
      if (level.stocked_quantity !== desired) {
        update.push({
          id: level.id,
          inventory_item_id: item.inventory_item_id,
          location_id: ctx.locationId,
          stocked_quantity: desired,
        })
      } else {
        stats.unchanged++
      }
    }

    const done = onlyVariantIds ? skip + take >= onlyVariantIds.length : rows.length < take
    if (done) break
  }

  for (let i = 0; i < Math.max(create.length, update.length); i += 500) {
    const c = create.slice(i, i + 500)
    const u = update.slice(i, i + 500)
    if (!c.length && !u.length) continue
    await batchInventoryItemLevelsWorkflow(ctx.container).run({ input: { create: c, update: u, delete: [] } })
  }
  stats.created = create.length
  stats.updated = update.length
  return stats
}
