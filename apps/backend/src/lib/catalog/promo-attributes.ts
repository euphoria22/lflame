import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCollectionsWorkflow, createProductTagsWorkflow, updateCollectionsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Поля для условий акций в Medusa («К каким товарам будет применяться акция?»).
 * Medusa даёт выбирать только товар, категорию, коллекцию, тип и тег — своих полей туда не добавить.
 * Поэтому: бренд → «Коллекция» товара (одна коллекция на бренд), пол, цвет и пометки → «Теги»
 * с приставками «Пол: », «Цвет: », «Метка: ». Остальные теги (добавленные вручную) не трогаем.
 */
const MANAGED = /^(Пол|Цвет|Метка): /
const GENDER: Record<string, string> = { men: "Мужское", women: "Женское", unisex: "Унисекс" }

type Row = {
  id: string
  collection_id?: string | null
  metadata?: Record<string, unknown> | null
  tags?: { id: string; value: string }[] | null
  brand?: { name: string; handle: string } | null
}

export function wantedTags(meta: Record<string, unknown>): string[] {
  const out: string[] = []
  const g = GENDER[String(meta.gender ?? "")]
  if (g) out.push(`Пол: ${g}`)
  if (typeof meta.color_name === "string" && meta.color_name.trim()) out.push(`Цвет: ${meta.color_name.trim()}`)
  if (meta.outlet) out.push("Метка: Outlet")
  if (meta.preorder) out.push("Метка: Предзаказ")
  if (meta.is_new === true) out.push("Метка: Новинка")
  if (meta.no_loyalty) out.push("Метка: Без скидок Club")
  return out
}

/** Проставить коллекцию-бренд и теги товарам (всем — без ids). Меняет только то, что отличается. */
export async function applyPromoAttributes(container: MedusaContainer, ids?: string[]): Promise<number> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const products = container.resolve(Modules.PRODUCT)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "collection_id", "metadata", "tags.id", "tags.value", "brand.name", "brand.handle"],
    ...(ids ? { filters: { id: ids } } : {}),
    pagination: { take: 100000 },
  })
  const rows = data as unknown as Row[]
  if (!rows.length) return 0

  // Коллекции по брендам: handle коллекции = handle бренда; название — как у бренда
  const collections = await products.listProductCollections({}, { take: 10000 })
  const byHandle = new Map(collections.map((c) => [c.handle, c]))
  const brands = new Map(rows.filter((r) => r.brand).map((r) => [r.brand!.handle, r.brand!.name]))
  const createC = [...brands].filter(([h]) => !byHandle.has(h)).map(([handle, title]) => ({ handle, title }))
  if (createC.length) {
    const { result } = await createCollectionsWorkflow(container).run({ input: { collections: createC } })
    for (const c of result) byHandle.set(c.handle, c)
  }
  for (const [handle, title] of brands) {
    const c = byHandle.get(handle)
    if (c && c.title !== title) await updateCollectionsWorkflow(container).run({ input: { selector: { id: c.id }, update: { title } } })
  }

  // Теги
  const values = new Set(rows.flatMap((r) => wantedTags(r.metadata ?? {})))
  const tags = await products.listProductTags({}, { take: 10000 })
  const tagByValue = new Map(tags.map((t) => [t.value, t.id]))
  const createT = [...values].filter((v) => !tagByValue.has(v)).map((value) => ({ value }))
  if (createT.length) {
    const { result } = await createProductTagsWorkflow(container).run({ input: { product_tags: createT } })
    for (const t of result) tagByValue.set(t.value, t.id)
  }

  const updates: { id: string; collection_id: string | null; tag_ids: string[] }[] = []
  for (const r of rows) {
    const collection_id = r.brand ? byHandle.get(r.brand.handle)?.id ?? null : null
    const keep = (r.tags ?? []).filter((t) => !MANAGED.test(t.value)).map((t) => t.id)
    const tag_ids = [...new Set([...keep, ...wantedTags(r.metadata ?? {}).map((v) => tagByValue.get(v)!).filter(Boolean)])].sort()
    const cur = (r.tags ?? []).map((t) => t.id).sort()
    if ((r.collection_id ?? null) !== collection_id || cur.join() !== tag_ids.join()) updates.push({ id: r.id, collection_id, tag_ids })
  }
  for (let i = 0; i < updates.length; i += 100) {
    await updateProductsWorkflow(container).run({ input: { products: updates.slice(i, i + 100) } })
  }
  return updates.length
}
