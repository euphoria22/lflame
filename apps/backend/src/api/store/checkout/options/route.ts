import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getShopSettings } from "../../../../lib/settings/shop-settings"

/** Настройки оформления для витрины: способы оплаты, бесплатная доставка. */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const s = await getShopSettings()
  res.json({
    online_payment: Boolean(process.env.TBANK_TERMINAL_KEY && process.env.TBANK_PASSWORD),
    // Оплата частями: ключ Яндекс Пэй задан в .env.backend
    split_payment: Boolean(process.env.YANDEX_PAY_API_KEY),
    // Merchant ID — для официальных бейджей Сплита на витрине (не секрет: виден в коде страницы)
    split_merchant_id: process.env.YANDEX_PAY_API_KEY ? process.env.YANDEX_PAY_MERCHANT_ID || null : null,
    delivery_texts: s.delivery_texts,
    payment_logos: s.payment_logos,
    manual_payment: s.payments.manual,
    cod_methods: s.payments.cod_methods,
    free_shipping_from: s.free_shipping_from,
    free_shipping_methods: s.free_shipping_methods,
  })
}
