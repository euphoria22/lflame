import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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
  res.json({
    settings,
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

export async function POST(req: MedusaRequest<Partial<ShopSettings>>, res: MedusaResponse) {
  const { value, error } = validateSettings(req.body ?? {})
  if (error || !value) {
    res.status(400).json({ message: error })
    return
  }
  res.json({ settings: await saveShopSettings(value) })
}
