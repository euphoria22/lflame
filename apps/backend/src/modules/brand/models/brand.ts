import { model } from "@medusajs/framework/utils"

/**
 * Бренд (ТЗ, п. 2.2). Страница бренда /brands/{handle}, посадочные «категория + бренд».
 * aliases — другие написания для автоопределения по названию товара ("C.P Company").
 */
const Brand = model.define("brand", {
  id: model.id({ prefix: "brand" }).primaryKey(),
  name: model.text().searchable(),
  handle: model.text().unique(),
  aliases: model.json().nullable(),
  logo_url: model.text().nullable(),
  country: model.text().nullable(),
  short_description: model.text().nullable(),
  description: model.text().nullable(),
  seo_title: model.text().nullable(),
  seo_description: model.text().nullable(),
  seo_text: model.text().nullable(),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default Brand
