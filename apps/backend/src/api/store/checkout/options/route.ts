import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { freeShippingFrom } from "../../../../lib/delivery/free-shipping"

/** Настройки оформления для витрины: доступна ли онлайн-оплата, порог бесплатной доставки. */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({
    online_payment: Boolean(process.env.TBANK_TERMINAL_KEY && process.env.TBANK_PASSWORD),
    free_shipping_from: await freeShippingFrom(),
  })
}
