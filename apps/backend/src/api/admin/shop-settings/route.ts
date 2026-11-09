import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { cdekConfig, cdekRequest, CdekTariff, cdekTariffList } from "../../../lib/delivery/cdek-client"
import { DEFAULT_PARCEL, estimateParcel } from "../../../lib/delivery/parcel"
import { getShopSettings, saveShopSettings, ShopSettings, validateSettings } from "../../../lib/settings/shop-settings"

type Point = { code: string; location: { address: string } }

/** Настройки «Доставка и оплата» + состояние подключений (ключи не показываются). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const settings = await getShopSettings()
  const cdek = cdekConfig()
  const terminal = process.env.TBANK_TERMINAL_KEY ?? ""
  const backend = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
  let points: { code: string; address: string }[] = []
  let cdekError: string | null = null
  try {
    const rows = await cdekRequest<Point[]>("/deliverypoints", { query: { city_code: cdek.fromCityCode, type: "PVZ", is_reception: "true" } })
    points = rows.map((p) => ({ code: p.code, address: p.location.address })).sort((a, b) => a.address.localeCompare(b.address, "ru"))
  } catch (e) {
    cdekError = (e as Error).message
  }
  // Тарифы на примере: Омск → Москва, джинсы (вес и коробка — по текущим настройкам)
  let tariffs: CdekTariff[] = []
  try {
    tariffs = await cdekTariffList(44, estimateParcel([{ product_title: "Джинсы", quantity: 1 }], settings.parcel))
  } catch (e) {
    cdekError ??= (e as Error).message
  }
  const courier = await omskCourier(req)
  res.json({
    settings,
    courier_price: courier?.price ?? null,
    defaults: { parcel: DEFAULT_PARCEL },
    cdek: {
      mode: cdek.baseUrl.includes(".edu.") ? "test" : "production",
      own_keys: Boolean(process.env.CDEK_CLIENT_ID),
      error: cdekError,
      points,
      tariffs,
      example: "Омск → Москва, джинсы",
      webhook_url: `${backend}/hooks/cdek/…`,
    },
    tbank: {
      configured: Boolean(terminal && process.env.TBANK_PASSWORD),
      mode: !terminal ? "off" : terminal.toUpperCase().endsWith("DEMO") ? "test" : "production",
      terminal: terminal ? `${terminal.slice(0, 4)}…${terminal.slice(-4)}` : null,
      receipts: Boolean(process.env.TBANK_TAXATION),
      notification_url: `${backend}/hooks/payment/tbank_tbank`,
    },
  })
}

export async function POST(req: MedusaRequest<Partial<ShopSettings> & { courier_price?: number }>, res: MedusaResponse) {
  const { courier_price, ...rest } = req.body ?? {}
  if (courier_price !== undefined && courier_price !== null) {
    const price = Math.round(Number(courier_price))
    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      res.status(400).json({ message: "Цена курьера: от 0 ₽" })
      return
    }
    const courier = await omskCourier(req)
    if (courier && courier.price !== price) {
      await updateShippingOptionsWorkflow(req.scope).run({ input: [{ id: courier.id, prices: [{ currency_code: "rub", amount: price }] }] })
    }
  }
  const { value, error } = validateSettings(rest)
  if (error || !value) {
    res.status(400).json({ message: error })
    return
  }
  res.json({ settings: await saveShopSettings(value) })
}

type OptionRow = { id: string; type?: { code?: string } | null; prices?: { amount: unknown; currency_code: string }[] }

/** Курьер по Омску: способ доставки с фиксированной ценой (создаётся setup-delivery.ts). */
async function omskCourier(req: MedusaRequest): Promise<{ id: string; price: number } | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "shipping_option", fields: ["id", "type.code", "prices.amount", "prices.currency_code"] })
  const o = (data as OptionRow[]).find((x) => x.type?.code === "omsk-courier")
  if (!o) return null
  return { id: o.id, price: Number(o.prices?.find((p) => p.currency_code === "rub")?.amount ?? 0) }
}
