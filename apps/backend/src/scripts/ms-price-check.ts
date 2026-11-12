import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import MoyskladModuleService from "../modules/moysklad/service"
import { DEFAULT_MAP_OPTIONS } from "../lib/moysklad/map-product"
import type { MsProduct, MsVariant } from "../lib/moysklad/types"

/**
 * Откуда цена: цена товара и каждой модификации в МС и цены размеров на сайте. Только читает.
 *   npx medusa exec ./src/scripts/ms-price-check.js "HUF OG Logo Sand"
 */
export default async function msPriceCheck({ container, args = [] }: ExecArgs) {
  const q = args.join(" ").trim()
  if (!q) return console.log("Укажите часть названия товара в кавычках")
  const ms = container.resolve<MoyskladModuleService>(MOYSKLAD_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const rub = (prices: MsProduct["salePrices"] | undefined, name: string) => {
    const v = prices?.find((p) => p.priceType?.name === name)?.value
    return v === undefined ? "—" : `${v / 100} ₽`
  }
  const products = (await ms.api.get<{ rows: MsProduct[] }>("entity/product", { search: q, limit: 5 })).rows
  if (!products.length) return console.log(`В МС не найдено: ${q}`)
  for (const p of products) {
    console.log(`\n=== ${p.name}${p.archived ? " (в архиве)" : ""}`)
    console.log(`Товар в МС: ${DEFAULT_MAP_OPTIONS.salePriceName} ${rub(p.salePrices, DEFAULT_MAP_OPTIONS.salePriceName)}, ${DEFAULT_MAP_OPTIONS.oldPriceName} ${rub(p.salePrices, DEFAULT_MAP_OPTIONS.oldPriceName)}, изменён ${p.updated ?? "?"}`)
    const variants = (await ms.api.get<{ rows: MsVariant[] }>("entity/variant", { filter: `productid=${p.id}`, limit: 100 })).rows
    const { data } = await query.graph({ entity: "product", fields: ["title", "variants.title", "variants.metadata", "variants.prices.amount", "variants.prices.currency_code"], filters: { external_id: p.id } })
    const site = (data[0] as { variants?: { title: string; metadata?: Record<string, unknown>; prices?: { amount: number; currency_code: string }[] }[] } | undefined)?.variants ?? []
    if (!data.length) console.log("На сайте: товара нет")
    for (const v of variants) {
      const s = site.find((x) => x.metadata?.moysklad_id === v.id)
      const sitePrice = s?.prices?.find((x) => x.currency_code === "rub")?.amount
      console.log(`  ${v.name}: в МС модификация — ${rub(v.salePrices, DEFAULT_MAP_OPTIONS.salePriceName)}${v.archived ? " (в архиве)" : ""}; на сайте — ${sitePrice === undefined ? "нет" : `${sitePrice} ₽`}`)
    }
    if (!variants.length) {
      const s = site[0]?.prices?.find((x) => x.currency_code === "rub")?.amount
      console.log(`  Без модификаций; на сайте — ${s === undefined ? "нет" : `${s} ₽`}`)
    }
  }
}
