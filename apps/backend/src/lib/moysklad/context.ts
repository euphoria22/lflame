import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../../modules/moysklad"
import MoyskladModuleService from "../../modules/moysklad/service"
import { MsStockRow, MsStore } from "./types"

/** Название склада интернет-магазина в Medusa (создаётся initial-data-seed). */
export const MEDUSA_STOCK_LOCATION_NAME = "Склад интернет-магазина"

function resolveQuery(container: MedusaContainer) {
  return container.resolve(ContainerRegistrationKeys.QUERY)
}

export type SyncContext = {
  container: MedusaContainer
  ms: MoyskladModuleService
  query: ReturnType<typeof resolveQuery>
  logger: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void }
  locationId: string
  salesChannelId: string
  shippingProfileId: string
  msStoreId: string
}

export async function loadSyncContext(container: MedusaContainer): Promise<SyncContext> {
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  const query = resolveQuery(container)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (!ms.api.isConfigured()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "МойСклад: не задан MOYSKLAD_TOKEN")
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: MEDUSA_STOCK_LOCATION_NAME },
  })
  if (!locations.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Не найден склад «${MEDUSA_STOCK_LOCATION_NAME}» в Medusa`)
  }

  const { data: stores } = await query.graph({ entity: "store", fields: ["id", "default_sales_channel_id"] })
  const salesChannelId = stores[0]?.default_sales_channel_id
  if (!salesChannelId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "У магазина не задан канал продаж по умолчанию")
  }

  const { data: profiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "type"] })
  const shippingProfile = profiles.find((p: { type: string }) => p.type === "default") ?? profiles[0]

  const msStores = await ms.api.listAll<MsStore>("entity/store")
  const msStore = msStores.find((s) => s.name === ms.options.storeName)
  if (!msStore) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `МойСклад: склад «${ms.options.storeName}» не найден. Есть: ${msStores.map((s) => s.name).join(", ")}`
    )
  }

  return {
    container,
    ms,
    query,
    logger,
    locationId: locations[0].id,
    salesChannelId,
    shippingProfileId: shippingProfile.id,
    msStoreId: msStore.id,
  }
}

/** Свободный остаток (остаток минус резерв) по модификациям на складе интернет-магазина (ТЗ, п. 3.3). */
export async function fetchFreeStock(ctx: SyncContext): Promise<Map<string, number>> {
  const rows = await ctx.ms.api.get<MsStockRow[]>("report/stock/bystore/current", {
    filter: `storeId=${ctx.msStoreId}`,
    stockType: "freeStock",
  })
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.assortmentId, (map.get(r.assortmentId) ?? 0) + (r.freeStock ?? r.quantity ?? 0))
  }
  return map
}

/** Время для фильтра МС: "YYYY-MM-DD HH:mm:ss" по Москве. */
export function moyskladTime(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: "Europe/Moscow" }).replace("T", " ")
}
