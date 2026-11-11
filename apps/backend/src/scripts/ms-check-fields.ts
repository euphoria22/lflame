import { ExecArgs } from "@medusajs/framework/types"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import MoyskladModuleService from "../modules/moysklad/service"
import { attrValue, DEFAULT_MAP_OPTIONS } from "../lib/moysklad/map-product"
import type { MsProduct } from "../lib/moysklad/types"

/**
 * Проверка карточек МоегоСклада: у каких товаров не заполнены поля «Бренд» и «Цвет».
 * Только читает МС, ничего не меняет. Архивные товары не проверяются.
 *   npx medusa exec ./src/scripts/ms-check-fields.js
 */
export default async function msCheckFields({ container }: ExecArgs) {
  const ms = container.resolve<MoyskladModuleService>(MOYSKLAD_MODULE)
  const products = (await ms.api.listAll<MsProduct>("entity/product")).filter((p) => !p.archived)
  const field = (p: MsProduct, name: string) => attrValue(p.attributes?.find((a) => a.name === name)?.value)

  const rows: string[] = ["чего нет;папка;артикул;название"]
  let noBrand = 0, noColor = 0
  for (const p of products) {
    const missing: string[] = []
    if (!field(p, DEFAULT_MAP_OPTIONS.attrBrand)) { missing.push("бренд"); noBrand++ }
    if (!field(p, DEFAULT_MAP_OPTIONS.attrColor)) { missing.push("цвет"); noColor++ }
    if (missing.length) rows.push(`${missing.join(" и ")};${p.pathName ?? ""};${p.article ?? p.code ?? ""};${p.name}`)
  }
  const head = rows.shift()!
  rows.sort()
  const write = (text: string) => new Promise<void>((resolve) => process.stdout.write(text, () => resolve()))
  await write(`\n===ИТОГ===\n${JSON.stringify({ товаров: products.length, без_бренда: noBrand, без_цвета: noColor, с_пропусками: rows.length })}\n`)
  await write(`===СПИСОК===\n${[head, ...rows].join("\n")}\n===КОНЕЦ===\n`)
}
