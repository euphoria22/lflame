import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import MoyskladModuleService from "../modules/moysklad/service"
import { attrValue, DEFAULT_MAP_OPTIONS } from "../lib/moysklad/map-product"
import type { MsProduct } from "../lib/moysklad/types"

/**
 * Проверка карточек МоегоСклада: у каких товаров сайта не заполнены поля «Бренд» и «Цвет».
 * Только читает, ничего не меняет. Считаются только товары, которые есть на сайте (опубликованы);
 * в списке — ещё и удалось ли сайту самому определить бренд и цвет по названию.
 * С параметром all — все неархивные товары МС, в том числе которых нет на сайте.
 *   npx medusa exec ./src/scripts/ms-check-fields.js
 */
export default async function msCheckFields({ container, args = [] }: ExecArgs) {
  const ms = container.resolve<MoyskladModuleService>(MOYSKLAD_MODULE)
  const all = (await ms.api.listAll<MsProduct>("entity/product")).filter((p) => !p.archived)

  // Товары сайта: связь с МС — external_id
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["external_id", "status", "metadata", "brand.name"], pagination: { take: 100000 } })
  const site = new Map<string, { brand: string | null; color: string | null }>()
  for (const p of data as { external_id?: string | null; status: string; metadata?: Record<string, unknown> | null; brand?: { name?: string } | null }[]) {
    if (p.external_id && p.status === "published") site.set(p.external_id, { brand: p.brand?.name ?? null, color: (p.metadata?.color_name as string | null) ?? null })
  }
  const products = args.includes("all") ? all : all.filter((p) => site.has(p.id))
  const field = (p: MsProduct, name: string) => attrValue(p.attributes?.find((a) => a.name === name)?.value)

  const rows: string[] = ["чего нет в МС;на сайте бренд;на сайте цвет;папка;артикул;название"]
  let noBrand = 0, noColor = 0
  for (const p of products) {
    const missing: string[] = []
    if (!field(p, DEFAULT_MAP_OPTIONS.attrBrand)) { missing.push("бренд"); noBrand++ }
    if (!field(p, DEFAULT_MAP_OPTIONS.attrColor)) { missing.push("цвет"); noColor++ }
    const onSite = site.get(p.id)
    if (missing.length) rows.push(`${missing.join(" и ")};${onSite ? onSite.brand ?? "НЕТ" : "—"};${onSite ? onSite.color ?? "НЕТ" : "—"};${p.pathName ?? ""};${p.article ?? p.code ?? ""};${p.name}`)
  }
  const head = rows.shift()!
  rows.sort()
  const write = (text: string) => new Promise<void>((resolve) => process.stdout.write(text, () => resolve()))
  await write(`\n===ИТОГ===\n${JSON.stringify({ проверено: args.includes("all") ? "все товары МС" : "только товары сайта", товаров: products.length,
    на_сайте_без_бренда: products.filter((p) => site.get(p.id) && !site.get(p.id)!.brand).length,
    на_сайте_без_цвета: products.filter((p) => site.get(p.id) && !site.get(p.id)!.color).length, в_МС_без_бренда: noBrand, в_МС_без_цвета: noColor })}\n`)
  await write(`===СПИСОК===\n${[head, ...rows].join("\n")}\n===КОНЕЦ===\n`)
}
