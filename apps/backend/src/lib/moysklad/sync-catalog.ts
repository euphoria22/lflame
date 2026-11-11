import { createHash } from "crypto"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductVariantsWorkflow,
  updateProductOptionsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
  uploadFilesWorkflow,
} from "@medusajs/medusa/core-flows"
import { BRAND_MODULE } from "../../modules/brand"
import BrandModuleService from "../../modules/brand/service"
import { BRAND_SEED, BrandMatcher, brandHandle, matchBrand } from "../catalog/brands"
import { fixLatinLookalikes, slugify } from "../catalog/translit"
import { SyncContext, fetchFreeStock, moyskladTime } from "./context"
import { DEFAULT_MAP_OPTIONS, MapOptions, MappedProduct, attrValue, mapProduct } from "./map-product"
import { syncStockLevels } from "./sync-stock"
import { MsFolder, MsImage, MsProduct, MsVariant, idFromHref } from "./types"

export const SIZE_OPTION = "Размер"

/** Группы МС, которые не являются категориями сайта (остатки старых интеграций). */
const IGNORED_FOLDER_ROOTS = ["Товары интернет-магазинов"]

/** Сколько фото товара забирать из МС при создании. */
const MAX_IMAGES = 12

export type SyncCatalogInput = {
  /** full — весь каталог; incremental — изменённое с прошлого раза; products — конкретные товары */
  mode: "full" | "incremental" | "products"
  since?: Date
  productIds?: string[]
  /** Ограничение числа создаваемых товаров (для пробного запуска) */
  createLimit?: number
}

export type CatalogProblem = { moysklad_id: string; title: string; problems: string[] }

export type SyncCatalogStats = {
  fetched: number
  created: number
  updated: number
  unchanged: number
  skipped_no_stock: number
  skipped_no_price: number
  discontinued: number
  images_uploaded: number
  /** Черновики без фото, получившие фото из МС и опубликованные */
  images_published?: number
  categories_created: number
  brands_created: number
  errors: number
  stock?: Record<string, number>
}

type ExistingVariant = { id: string; sku?: string | null; metadata?: Record<string, unknown> | null; title?: string }
type ExistingProduct = {
  id: string
  handle: string
  status: string
  external_id: string | null
  metadata?: Record<string, unknown> | null
  images?: { id: string }[]
  options?: { id: string; title: string; values?: { value: string }[] }[]
  variants?: ExistingVariant[]
  brand?: { id: string } | null
}

/** Поле json в модели Medusa типизировано как объект; храним в нём массив написаний. */
const asJson = (value: string[]) => value as unknown as Record<string, unknown>

const hash = (value: unknown) => createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16)

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      await fn(items[next++])
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
}

function variantHash(v: MappedProduct["variants"][number], rank: number) {
  return hash([v.sku, v.barcode, v.price, v.compareAtPrice, rank])
}

function productHash(m: MappedProduct, categoryId: string | null, brandId: string | null) {
  return hash([m.title, categoryId, brandId, m.gender, m.color, m.oldSiteUrl, m.problems])
}

/**
 * Синхронизация каталога МС -> Medusa (ТЗ, п. 3.2).
 * Создаёт только товары с остатком и ценой; существующие обновляет всегда,
 * чтобы закончившийся товар оставался на сайте как «нет в наличии» (п. 7.6).
 */
export async function syncCatalog(
  ctx: SyncContext,
  input: SyncCatalogInput,
  onProblem: (p: CatalogProblem) => void
): Promise<SyncCatalogStats> {
  const { ms, logger } = ctx
  const api = ms.api
  const opts: MapOptions = {
    ...DEFAULT_MAP_OPTIONS,
    salePriceName: ms.options.salePriceName,
    oldPriceName: ms.options.oldPriceName,
  }
  const stats: SyncCatalogStats = {
    fetched: 0, created: 0, updated: 0, unchanged: 0, skipped_no_stock: 0, skipped_no_price: 0,
    discontinued: 0, images_uploaded: 0, categories_created: 0, brands_created: 0, errors: 0,
  }

  // 1. Данные МС
  const { products, archived } = await fetchProducts(ctx, input)
  stats.fetched = products.length
  logger.info(`МойСклад: получено товаров ${products.length} (режим ${input.mode})`)

  const variantsByProduct = await fetchVariants(ctx, input.mode === "full" ? null : products.map((p) => p.id))
  const freeStock = await fetchFreeStock(ctx)
  const folders = await api.listAll<MsFolder>("entity/productfolder")

  // 2. Справочники сайта
  const categoryByFolder = await ensureCategories(ctx, folders, stats)
  const brands = await ensureBrands(ctx, products, opts, stats)

  // 3. Сопоставление
  const mapped = products.map((p) => mapProduct(p, variantsByProduct.get(p.id) ?? [], freeStock, brands, opts))
  const existing = await loadExistingProducts(ctx, mapped.map((m) => m.moyskladId))
  const usedHandles = await loadHandles(ctx)

  const toCreate: MappedProduct[] = []
  for (const m of mapped) {
    const categoryId = m.folderId ? categoryByFolder.get(m.folderId) ?? null : null
    const problems = [...m.problems, ...(categoryId ? [] : ["Нет категории (группа МС не сопоставлена)"])]
    if (problems.length) {
      onProblem({ moysklad_id: m.moyskladId, title: m.title, problems })
    }
    const ex = existing.get(m.moyskladId)
    if (ex) {
      try {
        const changed = await updateProduct(ctx, m, ex, categoryId)
        changed ? stats.updated++ : stats.unchanged++
      } catch (e) {
        stats.errors++
        onProblem({ moysklad_id: m.moyskladId, title: m.title, problems: [`Ошибка обновления: ${(e as Error).message}`] })
      }
      continue
    }
    if (m.minPrice <= 0) {
      stats.skipped_no_price++
    } else if (m.totalStock <= 0) {
      stats.skipped_no_stock++
    } else {
      toCreate.push(m)
    }
  }

  // 4. Новые товары: по 4 параллельно (фото скачиваются дольше всего)
  const limit = input.createLimit ?? Infinity
  const queue = toCreate.slice(0, limit)
  for (const batch of chunk(queue, 20)) {
    await runPool(batch, 4, async (m) => {
      const categoryId = m.folderId ? categoryByFolder.get(m.folderId) ?? null : null
      try {
        await createProduct(ctx, m, categoryId, usedHandles, stats)
        stats.created++
      } catch (e) {
        stats.errors++
        logger.warn(`МойСклад: не создан товар «${m.title}»: ${(e as Error).message}`)
        onProblem({ moysklad_id: m.moyskladId, title: m.title, problems: [`Ошибка создания: ${(e as Error).message}`] })
      }
    })
    logger.info(`МойСклад: создано товаров ${stats.created} из ${queue.length}`)
  }

  // 5. Снятые с продажи (архив МС) — с публикации (п. 3.2, 7.6)
  if (archived.length) {
    const ex = await loadExistingProducts(ctx, archived.map((p) => p.id))
    for (const p of ex.values()) {
      if (p.status === ProductStatus.PUBLISHED || !p.metadata?.discontinued) {
        await updateProductsWorkflow(ctx.container).run({
          input: {
            products: [{ id: p.id, status: ProductStatus.DRAFT, metadata: { ...p.metadata, discontinued: true } }],
          },
        })
        stats.discontinued++
      }
    }
  }

  // 6. Товары, созданные без фото (черновики): фото могли добавить в МС позже
  await retryMissingImages(ctx, stats)

  // 7. Остатки
  stats.stock = await syncStockLevels(ctx, freeStock)
  return stats
}

async function fetchProducts(
  ctx: SyncContext,
  input: SyncCatalogInput
): Promise<{ products: MsProduct[]; archived: MsProduct[] }> {
  const api = ctx.ms.api
  if (input.mode === "full") {
    const all = await api.listAll<MsProduct>("entity/product")
    return { products: all.filter((p) => !p.archived), archived: all.filter((p) => p.archived) }
  }

  const ids = new Set<string>(input.productIds ?? [])
  if (input.mode === "incremental") {
    const since = moyskladTime(input.since ?? new Date(Date.now() - 24 * 3600 * 1000))
    const changed = await api.listAll<MsProduct>("entity/product", { filter: `updated>=${since}` })
    changed.forEach((p) => ids.add(p.id))
    // Цены и размеры меняются в модификациях: их товары тоже нужно пересчитать
    const changedVariants = await api.listAll<MsVariant>("entity/variant", { filter: `updated>=${since}` })
    changedVariants.forEach((v) => {
      const id = idFromHref(v.product.meta.href)
      if (id) ids.add(id)
    })
  }

  const products: MsProduct[] = []
  for (const group of chunk([...ids], 50)) {
    const rows = await api.listAll<MsProduct>("entity/product", {
      filter: group.map((id) => `id=${id}`).join(";"),
    })
    products.push(...rows)
  }
  return { products: products.filter((p) => !p.archived), archived: products.filter((p) => p.archived) }
}

async function fetchVariants(ctx: SyncContext, productIds: string[] | null): Promise<Map<string, MsVariant[]>> {
  const api = ctx.ms.api
  const rows: MsVariant[] = []
  if (productIds === null) {
    rows.push(...(await api.listAll<MsVariant>("entity/variant")))
  } else {
    for (const group of chunk(productIds, 40)) {
      rows.push(
        ...(await api.listAll<MsVariant>("entity/variant", {
          filter: group.map((id) => `productid=${id}`).join(";"),
        }))
      )
    }
  }
  const map = new Map<string, MsVariant[]>()
  for (const v of rows) {
    const pid = idFromHref(v.product.meta.href)
    if (!pid) continue
    const list = map.get(pid) ?? []
    list.push(v)
    map.set(pid, list)
  }
  return map
}

/** Группы МС -> категории сайта (п. 3.2). Сопоставление хранится в metadata.moysklad_folder_id. */
async function ensureCategories(
  ctx: SyncContext,
  folders: MsFolder[],
  stats: SyncCatalogStats
): Promise<Map<string, string>> {
  const { data } = await ctx.query.graph({ entity: "product_category", fields: ["id", "handle", "metadata"] })
  const byFolder = new Map<string, string>()
  const handles = new Set<string>()
  for (const c of data as { id: string; handle: string; metadata?: Record<string, unknown> }[]) {
    handles.add(c.handle)
    const fid = c.metadata?.moysklad_folder_id as string | undefined
    if (fid) byFolder.set(fid, c.id)
  }

  const missing = folders.filter((f) => {
    if (f.archived || byFolder.has(f.id)) return false
    const path = f.pathName ? `${f.pathName}/${f.name}` : f.name
    return !IGNORED_FOLDER_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))
  })
  if (!missing.length) return byFolder

  const input = missing.map((f) => {
    let handle = slugify(f.name)
    while (handles.has(handle)) handle = `${handle}-2`
    handles.add(handle)
    return { name: fixLatinLookalikes(f.name), handle, is_active: true, metadata: { moysklad_folder_id: f.id } }
  })
  const { result } = await createProductCategoriesWorkflow(ctx.container).run({
    input: { product_categories: input },
  })
  for (const c of result) {
    byFolder.set(c.metadata?.moysklad_folder_id as string, c.id)
  }
  stats.categories_created += result.length
  return byFolder
}

/**
 * Справочник брендов (п. 2.2): при первом запуске заполняется BRAND_SEED,
 * новые значения поля «Бренд» из МС добавляются автоматически.
 */
async function ensureBrands(
  ctx: SyncContext,
  products: MsProduct[],
  opts: MapOptions,
  stats: SyncCatalogStats
): Promise<BrandMatcher[]> {
  const brandService: BrandModuleService = ctx.container.resolve(BRAND_MODULE)
  let list = await brandService.listBrands({}, { take: 10000 })

  if (!list.length) {
    await brandService.createBrands(
      BRAND_SEED.map((b) => ({ name: b.name, handle: brandHandle(b), aliases: asJson(b.aliases ?? []) }))
    )
    stats.brands_created += BRAND_SEED.length
    list = await brandService.listBrands({}, { take: 10000 })
  }

  const toMatchers = (rows: typeof list): BrandMatcher[] =>
    // Скрытые на сайте бренды тоже сопоставляются: иначе их товары остались бы без бренда
    rows
      .map((b) => ({ key: b.id, name: b.name, aliases: (b.aliases as unknown as string[] | null) ?? [] }))

  let matchers = toMatchers(list)
  const handles = new Set(list.map((b) => b.handle))
  const fieldValues = new Set<string>()
  for (const p of products) {
    const v = attrValue(p.attributes?.find((a) => a.name === opts.attrBrand)?.value)
    if (v) fieldValues.add(v)
  }
  const fresh = [...fieldValues].filter((v) => !matchBrand(v, matchers))
  if (fresh.length) {
    const toCreate = fresh
      .map((name) => ({ name, handle: slugify(name), aliases: asJson([]) }))
      .filter((b) => b.handle && !handles.has(b.handle))
    if (toCreate.length) {
      await brandService.createBrands(toCreate)
      stats.brands_created += toCreate.length
      matchers = toMatchers(await brandService.listBrands({}, { take: 10000 }))
    }
  }
  return matchers
}

async function loadExistingProducts(ctx: SyncContext, msIds: string[]): Promise<Map<string, ExistingProduct>> {
  const map = new Map<string, ExistingProduct>()
  for (const group of chunk(msIds, 200)) {
    const { data } = await ctx.query.graph({
      entity: "product",
      fields: [
        "id", "handle", "status", "external_id", "metadata",
        "images.id",
        "options.id", "options.title", "options.values.value",
        "variants.id", "variants.sku", "variants.title", "variants.metadata",
        "brand.id",
      ],
      filters: { external_id: group },
    })
    for (const p of data as ExistingProduct[]) {
      if (p.external_id) map.set(p.external_id, p)
    }
  }
  return map
}

async function loadHandles(ctx: SyncContext): Promise<Set<string>> {
  const handles = new Set<string>()
  const take = 5000
  for (let skip = 0; ; skip += take) {
    const { data } = await ctx.query.graph({ entity: "product", fields: ["handle"], pagination: { take, skip } })
    data.forEach((p: { handle: string }) => handles.add(p.handle))
    if (data.length < take) return handles
  }
}

function uniqueHandle(base: string, msCode: string, used: Set<string>): string {
  let handle = base || `product-${msCode}`
  if (used.has(handle)) handle = `${handle}-${msCode.slice(-6)}`
  let n = 2
  while (used.has(handle)) handle = `${base}-${n++}`
  used.add(handle)
  return handle
}

function productMetadata(m: MappedProduct, categoryId: string | null, brandId: string | null) {
  return {
    moysklad_id: m.moyskladId,
    gender: m.gender,
    color: m.color,
    color_name: m.colorName,
    old_site_url: m.oldSiteUrl,
    problems: m.problems,
    sync_hash: productHash(m, categoryId, brandId),
  }
}

function variantInput(m: MappedProduct["variants"][number], rank: number) {
  return {
    title: m.size,
    // Порядок размеров на витрине: XS, S, M, L, XL…
    variant_rank: rank,
    sku: m.sku,
    barcode: m.barcode ?? undefined,
    options: { [SIZE_OPTION]: m.size },
    manage_inventory: true,
    allow_backorder: false,
    prices: [{ currency_code: "rub", amount: m.price }],
    metadata: {
      moysklad_id: m.moyskladId,
      compare_at_price: m.compareAtPrice,
      sync_hash: variantHash(m, rank),
    },
  }
}

/** Фото из МС -> файловое хранилище Medusa (S3 на production). Имена файлов — транслит (п. 7.11). */
async function importImages(
  ctx: SyncContext,
  msProductId: string,
  handle: string,
  stats: SyncCatalogStats
): Promise<string[]> {
  const list = await ctx.ms.api.get<{ rows: MsImage[] }>(`entity/product/${msProductId}/images`)
  const files: { filename: string; mimeType: string; content: string; access: "public" }[] = []
  const downloaded = await Promise.all(
    list.rows.slice(0, MAX_IMAGES).map(async (img, i) => {
      if (!img.meta.downloadHref) return null
      const { buffer, contentType } = await ctx.ms.api.download(img.meta.downloadHref)
      const ext = (img.filename.split(".").pop() || "jpg").toLowerCase()
      return {
        filename: `${handle}-${i + 1}.${ext}`,
        mimeType: contentType.startsWith("image/") ? contentType : `image/${ext === "jpg" ? "jpeg" : ext}`,
        content: buffer.toString("base64"),
        access: "public" as const,
      }
    })
  )
  // Порядок фото сохраняется как в МС
  files.push(...downloaded.filter((f): f is NonNullable<typeof f> => f !== null))
  if (!files.length) return []
  const { result } = await uploadFilesWorkflow(ctx.container).run({ input: { files } })
  stats.images_uploaded += result.length
  return result.map((f) => f.url)
}

/**
 * Товар без фото создаётся черновиком (п. 2.3). Если фото потом добавили в МС — забираем их и публикуем.
 * Проверяются только черновики без фото, не снятые с продажи; уже загруженные фото сайт не трогает.
 */
export async function retryMissingImages(ctx: SyncContext, stats: SyncCatalogStats) {
  const { data } = await ctx.query.graph({
    entity: "product",
    fields: ["id", "handle", "external_id", "metadata", "images.id"],
    filters: { status: ProductStatus.DRAFT },
    pagination: { take: 5000 },
  })
  const waiting = (data as { id: string; handle: string; external_id: string | null; metadata: Record<string, unknown> | null; images?: { id: string }[] }[])
    .filter((p) => p.external_id && !p.images?.length && !p.metadata?.discontinued)
  for (const p of waiting) {
    try {
      const images = await importImages(ctx, p.external_id!, p.handle, stats)
      if (!images.length) continue
      await updateProductsWorkflow(ctx.container).run({
        input: { products: [{ id: p.id, images: images.map((url) => ({ url })), thumbnail: images[0], status: ProductStatus.PUBLISHED }] },
      })
      stats.images_published = (stats.images_published ?? 0) + 1
      ctx.container.resolve(ContainerRegistrationKeys.LOGGER).info(`МойСклад: у товара ${p.handle} появились фото — опубликован`)
    } catch (e) {
      stats.errors++
      ctx.container.resolve(ContainerRegistrationKeys.LOGGER).warn(`МойСклад: фото для ${p.handle} не загружены: ${(e as Error).message}`)
    }
  }
}

async function linkBrand(ctx: SyncContext, productId: string, brandId: string | null, previous?: string | null) {
  const link = ctx.container.resolve(ContainerRegistrationKeys.LINK)
  if (previous && previous !== brandId) {
    await link.dismiss({ [Modules.PRODUCT]: { product_id: productId }, [BRAND_MODULE]: { brand_id: previous } })
  }
  if (brandId && previous !== brandId) {
    await link.create({ [Modules.PRODUCT]: { product_id: productId }, [BRAND_MODULE]: { brand_id: brandId } })
  }
}

async function createProduct(
  ctx: SyncContext,
  m: MappedProduct,
  categoryId: string | null,
  usedHandles: Set<string>,
  stats: SyncCatalogStats
) {
  const handle = uniqueHandle(m.handleBase, m.variants[0]?.sku ?? m.moyskladId, usedHandles)
  const images = await importImages(ctx, m.moyskladId, handle, stats)
  const brandId = m.brand?.key ?? null

  const { result } = await createProductsWorkflow(ctx.container).run({
    input: {
      products: [
        {
          title: m.title,
          handle,
          // Товар без фото не публикуется (п. 2.3)
          status: images.length ? ProductStatus.PUBLISHED : ProductStatus.DRAFT,
          external_id: m.moyskladId,
          description: m.description ?? undefined,
          category_ids: categoryId ? [categoryId] : [],
          shipping_profile_id: ctx.shippingProfileId,
          sales_channels: [{ id: ctx.salesChannelId }],
          images: images.map((url) => ({ url })),
          thumbnail: images[0],
          options: [{ title: SIZE_OPTION, values: m.sizes }],
          variants: m.variants.map((v, i) => variantInput(v, i)),
          // Пометка «Предзаказ» из доп. поля МС — при создании; дальше флажок ведётся в админке сайта
          metadata: { ...productMetadata(m, categoryId, brandId), ...(m.preorder ? { preorder: true } : {}) },
        },
      ],
    },
  })
  await linkBrand(ctx, result[0].id, brandId)
}

/** Обновление существующего товара. Возвращает true, если что-то изменилось. */
async function updateProduct(
  ctx: SyncContext,
  m: MappedProduct,
  ex: ExistingProduct,
  categoryId: string | null
): Promise<boolean> {
  let changed = false
  const brandId = m.brand?.key ?? null
  const meta = productMetadata(m, categoryId, brandId)

  // Название, категория, пол, цвет — из МС. Описание, фото, SEO, slug — сайт (п. 2.3)
  if (ex.metadata?.sync_hash !== meta.sync_hash) {
    await updateProductsWorkflow(ctx.container).run({
      input: {
        products: [
          {
            id: ex.id,
            title: m.title,
            category_ids: categoryId ? [categoryId] : [],
            metadata: { ...ex.metadata, ...meta },
          },
        ],
      },
    })
    changed = true
  }
  if ((ex.brand?.id ?? null) !== brandId) {
    await linkBrand(ctx, ex.id, brandId, ex.brand?.id ?? null)
    changed = true
  }

  const byMsId = new Map((ex.variants ?? []).map((v) => [v.metadata?.moysklad_id as string, v]))
  const updates: ReturnType<typeof variantInput>[] = []
  const creates: MappedProduct["variants"] = []
  const rankOf = new Map(m.variants.map((v, i) => [v.moyskladId, i]))
  for (const v of m.variants) {
    const exV = byMsId.get(v.moyskladId)
    if (!exV) {
      creates.push(v)
    } else if (exV.metadata?.sync_hash !== variantHash(v, rankOf.get(v.moyskladId)!)) {
      updates.push({ ...variantInput(v, rankOf.get(v.moyskladId)!), id: exV.id } as ReturnType<typeof variantInput> & { id: string })
    }
  }

  if (updates.length) {
    await updateProductVariantsWorkflow(ctx.container).run({
      input: {
        product_variants: updates.map(({ options: _o, title: _t, ...rest }) => rest),
      },
    })
    changed = true
  }

  if (creates.length) {
    const option = ex.options?.find((o) => o.title === SIZE_OPTION)
    const known = new Set(option?.values?.map((v) => v.value) ?? [])
    const newValues = creates.map((v) => v.size).filter((s) => !known.has(s))
    if (option && newValues.length) {
      await updateProductOptionsWorkflow(ctx.container).run({
        input: { selector: { id: option.id }, update: { values: [...known, ...newValues] } },
      })
    }
    await createProductVariantsWorkflow(ctx.container).run({
      input: {
        product_variants: creates.map((v) => ({ ...variantInput(v, rankOf.get(v.moyskladId)!), product_id: ex.id })),
      },
    })
    changed = true
  }
  return changed
}
