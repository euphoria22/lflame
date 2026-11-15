import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffEmail } from "../../../../lib/admin/staff"
import { loadCatalogItems } from "../../../../lib/catalog/store-catalog"
import { unsubscribeUrl } from "../../../../lib/newsletter/newsletter"
import { sendMail } from "../../../../lib/notify/mailer"
import { abandonedCartMail, site } from "../../../../lib/notify/templates"
import { getShopSettings } from "../../../../lib/settings/shop-settings"

/** Пробное письмо о брошенной корзине себе: два товара из каталога, промокод — образец (не настоящий) */
export async function POST(req: AuthenticatedMedusaRequest<{ email?: string }>, res: MedusaResponse) {
  const to = String(req.body?.email || (await staffEmail(req))).trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { res.status(400).json({ message: "Укажите почту" }); return }
  try {
    const s = (await getShopSettings()).abandoned_cart
    const items = (await loadCatalogItems(req.scope)).filter((i) => i.in_stock && i.thumbnail).slice(0, 2).map((i) => ({
      title: i.title, variant: i.sizes.find((z) => z.in_stock)?.size ?? "", quantity: 1, price: i.price, image: i.thumbnail, url: `${site()}/product/${i.handle}`,
    }))
    await sendMail(abandonedCartMail(to, { items, restoreUrl: `${site()}/cart`, code: s.discount_pct > 0 ? "BACK-ОБРАЗЕЦ" : null, pct: s.discount_pct, unsubscribeUrl: unsubscribeUrl(to) }), req.scope.resolve("logger"))
    res.json({ ok: true, to })
  } catch (e) {
    req.scope.resolve("logger").error(`Пробное письмо о брошенной корзине: ${(e as Error).message}`)
    res.status(400).json({ message: `Не отправилось: ${(e as Error).message}` })
  }
}
