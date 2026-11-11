import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, getVariantAvailability } from "@medusajs/framework/utils"
import { sortSizes } from "./sizes"
import { salesByMoyskladId } from "../moysklad/sales"

/**
 * Данные каталога для витрины (ТЗ, п. 6.2, 6.3).
 * Витрина кэширует их и сама фильтрует: при 1–10 тыс. товаров это быстрее и проще
 * отдельного поискового движка, а кэш сбрасывается по событию (п. 7.1).
 */

export type CatalogBrandRef = { handle: string; name: string }
export type CatalogCategoryRef = { handle: string; name: string }

export type CatalogItem = {
  id: string
  handle: string
  title: string
  brand: CatalogBrandRef | null
  category: CatalogCategoryRef | null
  gender: string
  color: string | null
  color_name: string | null
  thumbnail: string | null
  /** Второе фото для смены при наведении */
  hover_image: string | null
  /** Минимальная цена среди размеров в наличии (или среди всех, если нет в наличии), ₽ */
  price: number
  /** Зачёркнутая цена для этой же позиции, ₽ */
  compare_at: number | null
  sizes: { size: string; in_stock: boolean; variant_id: string }[]
  in_stock: boolean
  /** Предзаказ: товар в пути, остаток внесён в МС (пометка на витрине, флажок в админке) */
  preorder: boolean
  /** Ожидаемая дата поступления предзаказа, ГГГГ-ММ-ДД */
  preorder_date: string | null
  /** Для сортировки «Популярные»: продажи за 60 дней (магазин + сайт), фото, описание, закрепление */
  sales: number
  images_count: number
  has_description: boolean
  pinned: boolean
  /** Флажок «Новинка» в админке: товар в новинках независимо от даты */
  new_manual: boolean
  /** Пришёл с первой загрузкой каталога (запуск сайта) — не новинка, если не отмечен вручную */
  initial_import: boolean
  /** Outlet: вещь с небольшим дефектом (флажок в админке) и описание дефекта */
  outlet: boolean
  outlet_note: string | null
  /** Скидка программы лояльности не действует */
  no_loyalty: boolean
  created_at: string
  /** Путь на старом сайте (для 301, ТЗ, п. 7.14) */
  old_path: string | null
}

export type CatalogVariant = {
  id: string
  size: string
  sku: string | null
  price: number
  compare_at: number | null
  /** Доступно к заказу (не больше 10, точное число витрине не нужно) */
  available: number
}

export type CatalogProduct = CatalogItem & {
  description: string | null
  images: string[]
  variants: CatalogVariant[]
  brand_description: string | null
  specs: string | null
  status: "published" | "draft"
  discontinued: boolean
  updated_at: string
}

type Row = {
  id: string
  handle: string
  title: string
  external_id?: string | null
  description?: string | null
  status: string
  thumbnail?: string | null
  created_at: string | Date
  updated_at: string | Date
  metadata?: Record<string, unknown> | null
  images?: { url: string; rank?: number }[]
  categories?: { handle: string; name: string }[]
  brand?: { handle: string; name: string; description?: string | null; is_active?: boolean } | null
  sales_channels?: { id: string }[]
  variants?: {
    id: string
    title: string
    sku?: string | null
    variant_rank?: number | null
    metadata?: Record<string, unknown> | null
    prices?: { amount: number; currency_code: string }[]
  }[]
}

const FIELDS = [
  "id", "handle", "title", "description", "status", "thumbnail", "created_at", "updated_at", "metadata", "external_id",
  "images.url", "images.rank",
  "categories.handle", "categories.name",
  "brand.handle", "brand.name", "brand.is_active",
  "sales_channels.id",
  "variants.id", "variants.title", "variants.sku", "variants.variant_rank", "variants.metadata",
  "variants.prices.amount", "variants.prices.currency_code",
]

function resolveQuery(container: MedusaContainer) {
  return container.resolve(ContainerRegistrationKeys.QUERY)
}

async function availability(
  container: MedusaContainer,
  variantIds: string[],
  salesChannelId: string
): Promise<Map<string, number>> {
  const query = resolveQuery(container)
  const map = new Map<string, number>()
  for (let i = 0; i < variantIds.length; i += 1000) {
    const res = await getVariantAvailability(query, {
      variant_ids: variantIds.slice(i, i + 1000),
      sales_channel_id: salesChannelId,
    })
    for (const [id, v] of Object.entries(res)) {
      map.set(id, Math.max(0, v.availability ?? 0))
    }
  }
  return map
}

function rub(prices: { amount: number; currency_code: string }[] | undefined): number {
  return Number(prices?.find((p) => p.currency_code === "rub")?.amount ?? 0)
}

function toVariants(row: Row, stock: Map<string, number>): CatalogVariant[] {
  const variants = (row.variants ?? []).map((v) => ({
    id: v.id,
    size: v.title,
    sku: v.sku ?? null,
    rank: v.variant_rank ?? 0,
    price: rub(v.prices),
    compare_at: (v.metadata?.compare_at_price as number | null | undefined) ?? null,
    available: Math.min(10, stock.get(v.id) ?? 0),
  }))
  const order = sortSizes(variants.map((v) => v.size))
  return variants
    .sort((a, b) => a.rank - b.rank || order.indexOf(a.size) - order.indexOf(b.size))
    .map(({ rank: _rank, ...v }) => v)
}

function toItem(row: Row, variants: CatalogVariant[], start: number, sales = 0): CatalogItem {
  const images = [...(row.images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((i) => i.url)
  const inStock = variants.filter((v) => v.available > 0)
  const pool = (inStock.length ? inStock : variants).filter((v) => v.price > 0)
  const cheapest = pool.reduce<CatalogVariant | null>((min, v) => (!min || v.price < min.price ? v : min), null)
  const meta = row.metadata ?? {}
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    // Скрытый в админке бренд не показывается на сайте (товары остаются)
    brand: row.brand && row.brand.is_active !== false ? { handle: row.brand.handle, name: row.brand.name } : null,
    category: row.categories?.[0] ? { handle: row.categories[0].handle, name: row.categories[0].name } : null,
    gender: (meta.gender as string) ?? "men",
    color: (meta.color as string | null) ?? null,
    color_name: (meta.color_name as string | null) ?? null,
    thumbnail: row.thumbnail ?? images[0] ?? null,
    hover_image: images[1] ?? null,
    price: cheapest?.price ?? 0,
    compare_at: cheapest?.compare_at && cheapest.compare_at > cheapest.price ? cheapest.compare_at : null,
    sizes: variants.map((v) => ({ size: v.size, in_stock: v.available > 0, variant_id: v.id })),
    in_stock: inStock.length > 0,
    preorder: Boolean(meta.preorder),
    preorder_date: meta.preorder && typeof meta.preorder_date === "string" ? meta.preorder_date : null,
    sales,
    images_count: images.length,
    has_description: Boolean(row.description && row.description.trim() && !/^Оригинальный товар/i.test(row.description.trim())),
    pinned: meta.pinned === true,
    new_manual: meta.is_new === true,
    initial_import: new Date(row.created_at).getTime() < start + INITIAL_IMPORT_WINDOW,
    outlet: Boolean(meta.outlet),
    outlet_note: meta.outlet && typeof meta.outlet_note === "string" ? meta.outlet_note : null,
    no_loyalty: Boolean(meta.no_loyalty),
    created_at: new Date(row.created_at).toISOString(),
    old_path: oldPath(meta.old_site_url),
  }
}

function oldPath(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || null
  } catch {
    return null
  }
}

/** Остаток вариантов в канале «Интернет-магазин» (для «Сообщить о поступлении»). */
export async function variantStock(container: MedusaContainer, variantIds: string[]): Promise<Map<string, number>> {
  return availability(container, variantIds, await salesChannelId(container))
}

async function salesChannelId(container: MedusaContainer): Promise<string> {
  const { data } = await resolveQuery(container).graph({ entity: "store", fields: ["default_sales_channel_id"] })
  return data[0]?.default_sales_channel_id as string
}

/** Первая загрузка каталога длится не дольше суток: всё, что создано в эти сутки, — стартовый ассортимент. */
const INITIAL_IMPORT_WINDOW = 24 * 3600 * 1000
let catalogStartCache: number | null = null

/** Когда на сайте появился первый товар (начало первой загрузки из МоегоСклада). */
async function catalogStart(container: MedusaContainer): Promise<number> {
  if (catalogStartCache !== null) return catalogStartCache
  const { data } = await resolveQuery(container).graph({
    entity: "product", fields: ["created_at"], pagination: { take: 1, order: { created_at: "ASC" } },
  })
  const first = data[0] ? new Date((data[0] as { created_at: string | Date }).created_at).getTime() : Date.now()
  catalogStartCache = first
  return first
}

/** Все опубликованные товары канала «Интернет-магазин» в лёгком виде для листингов. */
export async function loadCatalogItems(container: MedusaContainer): Promise<CatalogItem[]> {
  const query = resolveQuery(container)
  const channel = await salesChannelId(container)
  const rows: Row[] = []
  const take = 500
  for (let skip = 0; ; skip += take) {
    const { data } = await query.graph({
      entity: "product",
      fields: FIELDS,
      filters: { status: "published" },
      pagination: { take, skip, order: { created_at: "DESC" } },
    })
    rows.push(...(data as Row[]))
    if (data.length < take) break
  }
  const visible = rows.filter((r) => r.sales_channels?.some((s) => s.id === channel))
  const stock = await availability(container, visible.flatMap((r) => (r.variants ?? []).map((v) => v.id)), channel)
  const [start, sales] = await Promise.all([catalogStart(container), salesByMoyskladId(container)])
  return visible.map((r) => toItem(r, toVariants(r, stock), start, sales.get(r.external_id ?? "") ?? 0)).filter((i) => i.price > 0)
}

/**
 * Один товар по адресу. Снятые с продажи возвращаются с discontinued=true,
 * чтобы витрина сделала 301 (ТЗ, п. 7.6). Неопубликованные без пометки — null (404).
 */
export async function loadCatalogProduct(container: MedusaContainer, handle: string): Promise<CatalogProduct | null> {
  const query = resolveQuery(container)
  const { data } = await query.graph({
    entity: "product",
    fields: [...FIELDS, "description", "brand.description"],
    filters: { handle },
  })
  const row = data[0] as Row | undefined
  if (!row) return null
  const discontinued = Boolean(row.metadata?.discontinued)
  if (row.status !== "published" && !discontinued) return null

  const channel = await salesChannelId(container)
  const stock = await availability(container, (row.variants ?? []).map((v) => v.id), channel)
  const variants = toVariants(row, stock)
  const images = [...(row.images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((i) => i.url)
  return {
    ...toItem(row, variants, await catalogStart(container)),
    description: row.description ?? null,
    images,
    variants,
    brand_description: row.brand?.is_active !== false ? row.brand?.description ?? null : null,
    // Состав, крой, детали, уход — «Ключ: значение» по строкам (перенесены со старого сайта)
    specs: typeof row.metadata?.old_site_specs === "string" ? row.metadata.old_site_specs : null,
    status: row.status === "published" ? "published" : "draft",
    discontinued,
    updated_at: new Date(row.updated_at).toISOString(),
  }
}

export type TaxonomyBrand = {
  handle: string
  name: string
  country: string | null
  logo_url: string | null
  short_description: string | null
  description: string | null
  seo_title: string | null
  seo_description: string | null
  seo_text: string | null
}

export type TaxonomyCategory = {
  handle: string
  name: string
  description: string | null
  rank: number
  parent_handle: string | null
  seo_title: string | null
  seo_description: string | null
  seo_text: string | null
}

/** Справочники для меню, страниц брендов и категорий, SEO-полей (ТЗ, п. 7.5, 7.11). */
export async function loadTaxonomy(container: MedusaContainer): Promise<{ brands: TaxonomyBrand[]; categories: TaxonomyCategory[] }> {
  const query = resolveQuery(container)
  const { data: brands } = await query.graph({
    entity: "brand",
    fields: ["handle", "name", "country", "logo_url", "short_description", "description", "seo_title", "seo_description", "seo_text", "is_active"],
    pagination: { take: 10000 },
  })
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["handle", "name", "description", "rank", "metadata", "is_active", "is_internal", "parent_category.handle"],
    pagination: { take: 10000 },
  })
  type Cat = {
    handle: string; name: string; description?: string | null; rank?: number
    metadata?: Record<string, unknown> | null; is_active: boolean; is_internal: boolean
    parent_category?: { handle: string } | null
  }
  return {
    brands: (brands as (TaxonomyBrand & { is_active: boolean })[])
      .filter((b) => b.is_active)
      .map(({ is_active: _a, ...b }) => b),
    categories: (categories as Cat[])
      .filter((c) => c.is_active && !c.is_internal)
      .map((c) => ({
        handle: c.handle,
        name: c.name,
        description: c.description || null,
        rank: c.rank ?? 0,
        parent_handle: c.parent_category?.handle ?? null,
        seo_title: (c.metadata?.seo_title as string) ?? null,
        seo_description: (c.metadata?.seo_description as string) ?? null,
        seo_text: (c.metadata?.seo_text as string) ?? null,
      })),
  }
}
