import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { revalidateCatalog } from "../brands/admin"

/** Флажки товара для сайта, хранятся в metadata (синхронизация с МС их не трогает). */
export const FLAGS = ["preorder", "is_new", "pinned", "outlet", "no_loyalty"] as const
export type Flag = (typeof FLAGS)[number]

export type SiteProductRow = {
  id: string; title: string; handle: string; thumbnail: string | null; status: string
  brand: string | null; category: string | null; created_at: string
  flags: Record<Flag, boolean>
}

type Raw = {
  id: string; title: string; handle: string; thumbnail?: string | null; status: string; created_at: string | Date
  metadata?: Record<string, unknown> | null; brand?: { name?: string | null } | null; categories?: { name?: string | null }[] | null
}

const flagsOf = (m: Record<string, unknown>): Record<Flag, boolean> => ({
  preorder: Boolean(m.preorder), is_new: m.is_new === true, pinned: m.pinned === true, outlet: Boolean(m.outlet), no_loyalty: Boolean(m.no_loyalty),
})

/** Все товары с флажками — для страницы массовой правки (фильтры и сортировка — в админке). */
export async function listSiteProducts(container: MedusaContainer): Promise<SiteProductRow[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "status", "created_at", "metadata", "brand.name", "categories.name"],
    pagination: { take: 100000 },
  })
  return (data as unknown as Raw[]).map((p) => ({
    id: p.id, title: p.title, handle: p.handle, thumbnail: p.thumbnail ?? null, status: p.status,
    brand: p.brand?.name ?? null, category: p.categories?.[0]?.name ?? null,
    created_at: new Date(p.created_at).toISOString(),
    flags: flagsOf(p.metadata ?? {}),
  }))
}

/** Включить или выключить флажки у выбранных товаров. Остальные данные товара не меняются. */
export async function setFlags(container: MedusaContainer, ids: string[], set: Partial<Record<Flag, boolean>>): Promise<number> {
  const patch = Object.fromEntries(Object.entries(set).filter(([k, v]) => (FLAGS as readonly string[]).includes(k) && typeof v === "boolean"))
  if (!ids.length || !Object.keys(patch).length) return 0
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  let done = 0
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: ids.slice(i, i + 100) } })
    const products = (data as { id: string; metadata: Record<string, unknown> | null }[]).map((p) => {
      const meta: Record<string, unknown> = { ...(p.metadata ?? {}), ...patch }
      // Сняли предзаказ — дата больше не нужна
      if (patch.preorder === false) meta.preorder_date = null
      return { id: p.id, metadata: meta }
    })
    if (products.length) await updateProductsWorkflow(container).run({ input: { products } })
    done += products.length
  }
  await revalidateCatalog()
  return done
}
