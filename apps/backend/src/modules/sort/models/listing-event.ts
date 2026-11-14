import { model } from "@medusajs/framework/utils"

/**
 * События листингов по дням (listing_events_daily): показы, клики и корзины карточки в листинге.
 * *_top — то же для позиций 1–24 (CTR первой страницы). Строка с product_id «*» — визиты листинга (в impressions).
 */
const SortListingEvent = model.define("sort_listing_event", {
  id: model.id({ prefix: "sle" }).primaryKey(),
  /** ГГГГ-ММ-ДД по Москве */
  day: model.text().index(),
  product_id: model.text().index(),
  listing: model.text(),
  impressions: model.number().default(0),
  clicks: model.number().default(0),
  carts: model.number().default(0),
  impressions_top: model.number().default(0),
  clicks_top: model.number().default(0),
})

export default SortListingEvent
