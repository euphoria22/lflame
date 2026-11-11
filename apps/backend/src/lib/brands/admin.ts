import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { BRAND_MODULE } from "../../modules/brand"
import BrandModuleService from "../../modules/brand/service"

/**
 * Бренды в админке: список с числом товаров, правка (название, тексты, видимость, написания) и объединение.
 * Синхронизация с МоимСкладом сопоставляет бренды по названию и «другим написаниям», поэтому:
 *  - при переименовании прежнее название добавляется в написания — товары из МС продолжат попадать сюда;
 *  - при объединении название и написания второго бренда переходят к основному, его товары — тоже.
 */
export type BrandRow = {
  id: string; name: string; handle: string; is_active: boolean; aliases: string[]
  short_description: string | null; description: string | null
  seo_title: string | null; seo_description: string | null; seo_text: string | null
  products: number
}
export type BrandPatch = Partial<Pick<BrandRow, "name" | "is_active" | "aliases" | "short_description" | "description" | "seo_title" | "seo_description" | "seo_text">>

const service = (c: MedusaContainer) => c.resolve<BrandModuleService>(BRAND_MODULE)
const asJson = (v: string[]) => v as unknown as Record<string, unknown>
const aliasesOf = (b: { aliases?: unknown }) => (Array.isArray(b.aliases) ? (b.aliases as string[]) : [])
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Сбросить кэш витрины: бренды видны в меню, фильтрах и на страницах брендов. */
export async function revalidateCatalog(): Promise<void> {
  const url = process.env.STOREFRONT_URL
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET
  if (!url || !secret) return
  await fetch(`${url.replace(/\/+$/, "")}/api/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify({ tags: ["catalog"] }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
}

async function productIdsByBrand(container: MedusaContainer): Promise<Map<string, string[]>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "brand.id"], pagination: { take: 100000 } })
  const map = new Map<string, string[]>()
  for (const p of data as { id: string; brand?: { id: string } | null }[]) {
    if (!p.brand) continue
    map.set(p.brand.id, [...(map.get(p.brand.id) ?? []), p.id])
  }
  return map
}

export async function listBrandRows(container: MedusaContainer): Promise<BrandRow[]> {
  const [brands, byBrand] = await Promise.all([service(container).listBrands({}, { take: 10000 }), productIdsByBrand(container)])
  return brands
    .map((b) => ({
      id: b.id, name: b.name, handle: b.handle, is_active: b.is_active, aliases: aliasesOf(b),
      short_description: b.short_description ?? null, description: b.description ?? null,
      seo_title: b.seo_title ?? null, seo_description: b.seo_description ?? null, seo_text: b.seo_text ?? null,
      products: byBrand.get(b.id)?.length ?? 0,
    }))
    .sort((a, b) => b.products - a.products || a.name.localeCompare(b.name))
}

export async function updateBrandRow(container: MedusaContainer, id: string, patch: BrandPatch): Promise<void> {
  const svc = service(container)
  const brand = await svc.retrieveBrand(id).catch(() => null)
  if (!brand) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Бренд не найден")
  const text = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() ? v.trim() : null)

  let aliases = patch.aliases !== undefined ? patch.aliases.map((a) => a.trim()).filter(Boolean) : aliasesOf(brand)
  const name = patch.name?.trim()
  if (patch.name !== undefined && !name) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Название не может быть пустым")
  if (name && !same(name, brand.name)) {
    const others = await svc.listBrands({}, { take: 10000 })
    if (others.some((o) => o.id !== id && same(o.name, name))) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Бренд «${name}» уже есть — объедините их вместо переименования`)
    }
    // Прежнее название — в написания, чтобы МойСклад продолжал сопоставлять товары с этим брендом
    if (!aliases.some((a) => same(a, brand.name))) aliases = [...aliases, brand.name]
  }
  aliases = [...new Map(aliases.filter((a) => !same(a, name ?? brand.name)).map((a) => [a.toLowerCase(), a])).values()]

  await svc.updateBrands({
    id,
    ...(name ? { name } : {}),
    ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
    aliases: asJson(aliases),
    short_description: text(patch.short_description),
    description: text(patch.description),
    seo_title: text(patch.seo_title),
    seo_description: text(patch.seo_description),
    seo_text: text(patch.seo_text),
  })
  await revalidateCatalog()
}

/** Объединить: товары бренда from переходят к into, его название и написания — тоже; бренд from удаляется. */
export async function mergeBrands(container: MedusaContainer, fromId: string, intoId: string): Promise<{ moved: number }> {
  if (fromId === intoId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Нельзя объединить бренд сам с собой")
  const svc = service(container)
  const [from, into] = await Promise.all([svc.retrieveBrand(fromId).catch(() => null), svc.retrieveBrand(intoId).catch(() => null)])
  if (!from || !into) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Бренд не найден")

  const products = (await productIdsByBrand(container)).get(fromId) ?? []
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  if (products.length) {
    await link.dismiss(products.map((product_id) => ({ [Modules.PRODUCT]: { product_id }, [BRAND_MODULE]: { brand_id: fromId } })))
    await link.create(products.map((product_id) => ({ [Modules.PRODUCT]: { product_id }, [BRAND_MODULE]: { brand_id: intoId } })))
  }
  const aliases = [...aliasesOf(into), from.name, ...aliasesOf(from)].filter((a) => !same(a, into.name))
  await svc.updateBrands({ id: intoId, aliases: asJson([...new Map(aliases.map((a) => [a.toLowerCase(), a])).values()]) })
  // Тексты второго бренда не теряем, если у основного их нет
  const fill: Record<string, string> = {}
  for (const k of ["short_description", "description", "seo_title", "seo_description", "seo_text"] as const) {
    if (!into[k] && from[k]) fill[k] = from[k] as string
  }
  if (Object.keys(fill).length) await svc.updateBrands({ id: intoId, ...fill })
  await svc.deleteBrands(fromId)
  await revalidateCatalog()
  return { moved: products.length }
}
