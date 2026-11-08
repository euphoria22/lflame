import { container } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { DEFAULT_PARCEL, ParcelConfig, validateParcelConfig } from "../delivery/parcel"

/**
 * Настройки магазина, которые меняются в админке («Доставка и оплата»).
 * Хранятся в metadata магазина (store.metadata.shop_settings). Значения из .env — по умолчанию.
 * Кэш 30 секунд, после сохранения в админке сбрасывается сразу.
 */
export type ShopSettings = {
  /** Бесплатная доставка СДЭК и Почтой от суммы товаров, ₽ (0 — выключено) */
  free_shipping_from: number
  /** Пункт СДЭК, куда магазин сдаёт посылки */
  cdek_shipment_point: string
  /** Тариф СДЭК до пункта выдачи (136 — «Посылка склад-склад») */
  cdek_tariff_pvz: number
  /** Тариф СДЭК курьером (137 — «Посылка склад-дверь») */
  cdek_tariff_door: number
  /** Режимы выбранных тарифов (4 склад-склад, 2 дверь-склад, 3 склад-дверь, 1 дверь-дверь) */
  cdek_tariff_pvz_mode: number
  cdek_tariff_door_mode: number
  /** Адрес магазина для тарифов «от двери» (курьер СДЭК забирает посылку) */
  sender_address: string
  /** Вес и коробка по умолчанию — если у товара не заполнены */
  parcel: ParcelConfig
}

export function defaultSettings(): ShopSettings {
  const free = Number(process.env.FREE_SHIPPING_FROM ?? 12000)
  return {
    free_shipping_from: Number.isFinite(free) && free > 0 ? free : 0,
    cdek_shipment_point: process.env.CDEK_SHIPMENT_POINT || "OMS6",
    cdek_tariff_pvz: 136,
    cdek_tariff_door: 137,
    cdek_tariff_pvz_mode: 4,
    cdek_tariff_door_mode: 3,
    sender_address: "ул. Партизанская, 5а/8",
    parcel: DEFAULT_PARCEL,
  }
}

let cache: { value: ShopSettings; at: number } | null = null

type StoreRow = { id: string; metadata?: Record<string, unknown> | null }

async function firstStore(): Promise<StoreRow | null> {
  const stores = (await container.resolve(Modules.STORE).listStores({}, { take: 1 })) as StoreRow[]
  return stores[0] ?? null
}

export async function getShopSettings(): Promise<ShopSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value
  const defaults = defaultSettings()
  try {
    const saved = ((await firstStore())?.metadata?.shop_settings ?? {}) as Partial<ShopSettings>
    const value = { ...defaults, ...saved, parcel: { ...defaults.parcel, ...(saved.parcel ?? {}) } }
    cache = { value, at: Date.now() }
    return value
  } catch {
    // Контейнер ещё не готов (тесты, скрипты) — значения из .env
    return defaults
  }
}

export function validateSettings(input: Partial<ShopSettings>): { value?: Partial<ShopSettings>; error?: string } {
  const out: Partial<ShopSettings> = {}
  if (input.free_shipping_from !== undefined) {
    const n = Number(input.free_shipping_from)
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { error: "Сумма бесплатной доставки: число от 0" }
    out.free_shipping_from = Math.round(n)
  }
  if (input.cdek_shipment_point !== undefined) {
    const code = String(input.cdek_shipment_point).trim().toUpperCase()
    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) return { error: "Код пункта СДЭК, например OMS6" }
    out.cdek_shipment_point = code
  }
  for (const [k, ok] of [["cdek_tariff_pvz_mode", [2, 4, 6, 7]], ["cdek_tariff_door_mode", [1, 3]]] as const) {
    if (input[k] === undefined) continue
    const n = Number(input[k])
    if (!(ok as readonly number[]).includes(n)) return { error: k === "cdek_tariff_pvz_mode" ? "Тариф до пункта выдачи должен быть «…-склад» или «…-постамат»" : "Тариф курьером должен быть «…-дверь»" }
    out[k] = n
  }
  if (input.sender_address !== undefined) {
    const a = String(input.sender_address).trim()
    if (a.length < 5 || a.length > 200) return { error: "Адрес магазина: от 5 до 200 символов" }
    out.sender_address = a
  }
  for (const k of ["cdek_tariff_pvz", "cdek_tariff_door"] as const) {
    if (input[k] === undefined) continue
    const n = Number(input[k])
    if (!Number.isInteger(n) || n < 1 || n > 9999) return { error: "Код тарифа СДЭК — целое число" }
    out[k] = n
  }
  if (input.parcel !== undefined) {
    const r = validateParcelConfig(input.parcel)
    if (r.error) return { error: r.error }
    out.parcel = r.value
  }
  return { value: out }
}

export async function saveShopSettings(patch: Partial<ShopSettings>): Promise<ShopSettings> {
  const store = await firstStore()
  if (!store) throw new Error("Магазин не найден")
  const current = { ...defaultSettings(), ...((store.metadata?.shop_settings ?? {}) as Partial<ShopSettings>), ...patch }
  await container.resolve(Modules.STORE).updateStores(store.id, { metadata: { ...(store.metadata ?? {}), shop_settings: current } })
  cache = { value: current, at: Date.now() }
  return current
}
