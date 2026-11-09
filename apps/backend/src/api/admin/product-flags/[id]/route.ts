import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

type Body = { preorder?: boolean; no_loyalty?: boolean; preorder_date?: string | null }

/**
 * Флажки товара: «Предзаказ» (+ ожидаемая дата поступления) (пометка: товар в пути, продаётся по остатку из МС, как обычно)
 * и «Не действуют скидки лояльности». Хранятся в metadata товара; синхронизация с МС их не трогает.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: req.params.id } })
  const p = data[0] as { id: string; metadata: Record<string, unknown> | null } | undefined
  if (!p) {
    res.status(404).json({ message: "Товар не найден" })
    return
  }
  const b = req.body ?? {}
  const meta = { ...(p.metadata ?? {}) }
  if (typeof b.preorder === "boolean") meta.preorder = b.preorder
  if (typeof b.no_loyalty === "boolean") meta.no_loyalty = b.no_loyalty
  if (b.preorder_date !== undefined) {
    const d = String(b.preorder_date ?? "").trim()
    if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)))) {
      res.status(400).json({ message: "Дата в формате ГГГГ-ММ-ДД" })
      return
    }
    meta.preorder_date = d || null
  }
  await updateProductsWorkflow(req.scope).run({ input: { products: [{ id: p.id, metadata: meta }] } })
  res.json({ preorder: Boolean(meta.preorder), no_loyalty: Boolean(meta.no_loyalty), preorder_date: (meta.preorder_date as string | null) ?? null })
}
