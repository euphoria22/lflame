import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow, updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"

type Body = { preorder?: boolean; no_loyalty?: boolean }

/**
 * Флажки товара: «Предзаказ» (продаётся без остатка — размеры разрешают заказ сверх остатка)
 * и «Не действуют скидки лояльности». Хранятся в metadata товара; синхронизация с МС их не трогает.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "variants.id"], filters: { id: req.params.id } })
  const p = data[0] as { id: string; metadata: Record<string, unknown> | null; variants?: { id: string }[] } | undefined
  if (!p) {
    res.status(404).json({ message: "Товар не найден" })
    return
  }
  const b = req.body ?? {}
  const meta = { ...(p.metadata ?? {}) }
  if (typeof b.preorder === "boolean") meta.preorder = b.preorder
  if (typeof b.no_loyalty === "boolean") meta.no_loyalty = b.no_loyalty
  await updateProductsWorkflow(req.scope).run({ input: { products: [{ id: p.id, metadata: meta }] } })
  if (typeof b.preorder === "boolean" && p.variants?.length) {
    await updateProductVariantsWorkflow(req.scope).run({
      input: { product_variants: p.variants.map((v) => ({ id: v.id, allow_backorder: b.preorder })) },
    })
  }
  res.json({ preorder: Boolean(meta.preorder), no_loyalty: Boolean(meta.no_loyalty) })
}
