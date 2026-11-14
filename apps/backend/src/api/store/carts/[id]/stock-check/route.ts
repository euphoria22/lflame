import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { variantStock } from "../../../../../lib/catalog/store-catalog"

type Line = { variant_id: string | null; quantity: number; product_title?: string | null; variant_title?: string | null; title?: string | null }

/**
 * Хватает ли остатка на товары корзины — прямо перед отправкой на оплату.
 * Без этой проверки покупатель мог оплатить вещь, которую за это время продали в шоуруме:
 * Medusa проверяет остаток только при создании заказа (после оплаты) и тогда отменяет оформление.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.variant_id", "items.quantity", "items.product_title", "items.variant_title", "items.title"],
    filters: { id: req.params.id },
  })
  const items = ((data[0] as { items?: Line[] } | undefined)?.items ?? []).filter((i): i is Line & { variant_id: string } => Boolean(i.variant_id))
  if (!items.length) { res.json({ ok: true, short: [] }); return }
  const stock = await variantStock(req.scope, items.map((i) => i.variant_id))
  const need = new Map<string, number>()
  for (const i of items) need.set(i.variant_id, (need.get(i.variant_id) ?? 0) + Number(i.quantity || 0))
  const short = items
    .filter((i) => (stock.get(i.variant_id) ?? 0) < (need.get(i.variant_id) ?? 0))
    .map((i) => ({ variant_id: i.variant_id, title: i.product_title ?? i.title ?? "", size: i.variant_title ?? "", available: stock.get(i.variant_id) ?? 0, quantity: i.quantity }))
  res.json({ ok: !short.length, short })
}
