import { container } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { MerchSettings, mergeSettings, validateSettings } from "./autofill"

/** Правила выкладки (уровни брендов, плотность, размеры) — в metadata магазина: merch_settings */

type StoreRow = { id: string; metadata?: Record<string, unknown> | null }
async function storeRow(): Promise<StoreRow> {
  const stores = (await container.resolve(Modules.STORE).listStores({}, { take: 1 })) as StoreRow[]
  if (!stores[0]) throw new Error("Магазин не найден")
  return stores[0]
}

export async function loadMerchSettings(): Promise<MerchSettings> {
  return mergeSettings((await storeRow()).metadata?.merch_settings as Partial<MerchSettings> | undefined)
}

export async function saveMerchSettings(raw: unknown): Promise<MerchSettings> {
  const next = validateSettings(raw)
  // Перечитываем магазин прямо перед записью, чтобы не затереть соседние ключи metadata
  const s = await storeRow()
  await container.resolve(Modules.STORE).updateStores(s.id, { metadata: { ...(s.metadata ?? {}), merch_settings: next } })
  return next
}
