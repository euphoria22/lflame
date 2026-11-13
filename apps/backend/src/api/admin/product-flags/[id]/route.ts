import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { applyPromoAttributes } from "../../../../lib/catalog/promo-attributes"

type Body = { preorder?: boolean; no_loyalty?: boolean; no_discounts?: boolean; preorder_date?: string | null; outlet?: boolean; outlet_note?: string | null; is_new?: boolean; pinned?: boolean; specs?: string | null }

/**
 * Флажки товара: «Предзаказ» (+ ожидаемая дата поступления) (пометка: товар в пути, продаётся по остатку из МС, как обычно)
 * «Не действуют скидки лояльности», «Новинка» (в новинках независимо от даты) и «Outlet» (вещь с небольшим дефектом; + описание дефекта). Хранятся в metadata товара; синхронизация с МС их не трогает.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "discountable"], filters: { id: req.params.id } })
  const p = data[0] as { id: string; metadata: Record<string, unknown> | null; discountable?: boolean | null } | undefined
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
  if (typeof b.is_new === "boolean") meta.is_new = b.is_new
  if (typeof b.pinned === "boolean") meta.pinned = b.pinned
  if (typeof b.outlet === "boolean") meta.outlet = b.outlet
  if (b.outlet_note !== undefined) {
    const n = String(b.outlet_note ?? "").trim()
    if (n.length > 300) {
      res.status(400).json({ message: "Описание дефекта — не длиннее 300 символов" })
      return
    }
    meta.outlet_note = n || null
  }
  // Характеристики карточки (Состав, Крой, Детали…) — строки «Ключ: значение»
  if (b.specs !== undefined) {
    const t = String(b.specs ?? "").replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
    if (t.length > 3000) {
      res.status(400).json({ message: "Характеристики — не длиннее 3000 символов" })
      return
    }
    meta.old_site_specs = t || null
  }
  // «Без скидок вообще» — поле товара Medusa «Скидки»: на товар не действуют акции и промокоды (и Club — см. lib/loyalty/cart.ts)
  const discountable = typeof b.no_discounts === "boolean" ? !b.no_discounts : p.discountable !== false
  await updateProductsWorkflow(req.scope).run({ input: { products: [{ id: p.id, metadata: meta, discountable }] } })
  // Пометки — в теги «Метка: …» (условия акций)
  await applyPromoAttributes(req.scope, [p.id]).catch(() => null)
  res.json({
    preorder: Boolean(meta.preorder), no_loyalty: Boolean(meta.no_loyalty), no_discounts: !discountable, preorder_date: (meta.preorder_date as string | null) ?? null,
    outlet: Boolean(meta.outlet), outlet_note: (meta.outlet_note as string | null) ?? null, is_new: meta.is_new === true, pinned: meta.pinned === true,
    specs: (meta.old_site_specs as string | null) ?? null,
  })
}
