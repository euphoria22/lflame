import { model } from "@medusajs/framework/utils"

/** Подписчик на новости (форма в подвале сайта). Промокод — одноразовый, только для этого адреса. */
const NewsletterSubscriber = model.define("newsletter_subscriber", {
  id: model.id({ prefix: "nsub" }).primaryKey(),
  email: model.text().index(),
  /** Одноразовый промокод на скидку за подписку; null — подписка без скидки */
  promo_code: model.text().nullable(),
  source: model.text().default("footer"),
  unsubscribed_at: model.dateTime().nullable(),
})

export default NewsletterSubscriber
