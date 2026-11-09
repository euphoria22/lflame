import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getShopSettings } from "../../../../lib/settings/shop-settings"

/** Настройки оформления для витрины: способы оплаты, бесплатная доставка. */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const s = await getShopSettings()
  res.json({
    online_payment: Boolean(process.env.TBANK_TERMINAL_KEY && process.env.TBANK_PASSWORD),
    manual_payment: s.payments.manual,
    cod_methods: s.payments.cod_methods,
    free_shipping_from: s.free_shipping_from,
    free_shipping_methods: s.free_shipping_methods,
  })
}
