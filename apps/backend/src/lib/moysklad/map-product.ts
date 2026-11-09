import { BrandMatcher, detectBrand } from "../catalog/brands"
import { COLOR_NAMES, ColorCode, detectColor } from "../catalog/colors"
import { Gender, detectGender } from "../catalog/gender"
import { normalizeSize, sortSizes } from "../catalog/sizes"
import { slugify } from "../catalog/translit"
import { MsProduct, MsVariant, idFromHref } from "./types"

/** Настройки сопоставления (имена типов цен и доп. полей в МоемСкладе). */
export type MapOptions = {
  salePriceName: string
  oldPriceName: string
  attrBrand: string
  attrGender: string
  /** Доп. поле-флажок МС «Предзаказ»: новый товар сразу получает пометку «Предзаказ» */
  attrPreorder: string
  attrColor: string
  attrOldUrl: string
}

export const DEFAULT_MAP_OPTIONS: MapOptions = {
  salePriceName: "Цена продажи",
  oldPriceName: "Старая цена",
  attrBrand: "Бренд",
  attrGender: "Для кого",
  attrPreorder: "Предзаказ",
  attrColor: "Цвет",
  attrOldUrl: "Ссылка на товар",
}

export type MappedVariant = {
  moyskladId: string
  sku: string
  barcode: string | null
  size: string
  /** Цена продажи, ₽ */
  price: number
  /** Зачёркнутая цена, ₽ (только если больше цены продажи) */
  compareAtPrice: number | null
  /** Доступно к продаже на складе интернет-магазина */
  stock: number
}

export type MappedProduct = {
  moyskladId: string
  title: string
  handleBase: string
  folderId: string | null
  brand: BrandMatcher | null
  gender: Gender
  color: ColorCode | null
  colorName: string | null
  description: string | null
  oldSiteUrl: string | null
  variants: MappedVariant[]
  sizes: string[]
  totalStock: number
  /** Отмечен «Предзаказ» в МС */
  preorder: boolean
  /** Минимальная цена среди вариантов, ₽ (0 — цены нет) */
  minPrice: number
  /** Почему товар не может продаваться на сайте (пусто — может) */
  problems: string[]
}

function attr(p: MsProduct, name: string): string | null {
  const a = p.attributes?.find((x) => x.name === name)
  if (!a || a.value === undefined || a.value === null || a.value === "") return null
  return String(a.value)
}

/** Цена в рублях: МС хранит копейки. */
function price(prices: MsProduct["salePrices"], name: string): number {
  const v = prices?.find((x) => x.priceType?.name === name)?.value ?? 0
  return Math.round(v) / 100
}

function firstBarcode(barcodes: Record<string, string>[] | undefined): string | null {
  if (!barcodes?.length) return null
  const b = barcodes[0]
  return b.ean13 ?? b.ean8 ?? b.code128 ?? b.gtin ?? Object.values(b)[0] ?? null
}

/**
 * Товар МС + его модификации + остатки -> данные для сайта.
 * Не обращается к API и базе: всё нужное передаётся аргументами.
 */
export function mapProduct(
  product: MsProduct,
  variants: MsVariant[],
  stockByVariant: Map<string, number>,
  brands: BrandMatcher[],
  opts: MapOptions = DEFAULT_MAP_OPTIONS
): MappedProduct {
  const title = product.name.replace(/\s+/g, " ").trim()
  const brandMatch = detectBrand(title, attr(product, opts.attrBrand), brands)
  // Бренд вырезается перед поиском цвета: "Stone Island" не должен дать цвет «stone»
  const nameWithoutBrand = brandMatch
    ? title.toLowerCase().replace(brandMatch.alias, " ")
    : title
  const color = detectColor(nameWithoutBrand, attr(product, opts.attrColor))

  const productSale = price(product.salePrices, opts.salePriceName)
  const productOld = price(product.salePrices, opts.oldPriceName)

  const seenSizes = new Set<string>()
  const problems: string[] = []
  const mappedVariants: MappedVariant[] = []

  for (const v of variants.filter((x) => !x.archived)) {
    const rawSize = v.characteristics?.find((c) => c.name.toLowerCase() === "размер")?.value
      ?? v.characteristics?.[0]?.value
      ?? "One Size"
    let size = normalizeSize(rawSize)
    // Две модификации с одинаковым размером после нормализации ("M" и "М")
    if (seenSizes.has(size)) {
      problems.push(`Повтор размера «${size}» (модификация ${v.code ?? v.id})`)
      size = `${size} (${v.code ?? v.id.slice(0, 6)})`
    }
    seenSizes.add(size)

    const sale = price(v.salePrices, opts.salePriceName) || productSale
    const old = price(v.salePrices, opts.oldPriceName) || productOld
    mappedVariants.push({
      moyskladId: v.id,
      sku: v.code || v.id,
      barcode: firstBarcode(v.barcodes),
      size,
      price: sale,
      compareAtPrice: old > sale ? old : null,
      stock: Math.max(0, Math.floor(stockByVariant.get(v.id) ?? 0)),
    })
  }

  // Товар без модификаций продаётся как один размер
  if (!mappedVariants.length && (product.variantsCount ?? 0) === 0) {
    mappedVariants.push({
      moyskladId: product.id,
      sku: product.code || product.id,
      barcode: firstBarcode(product.barcodes),
      size: "One Size",
      price: productSale,
      compareAtPrice: productOld > productSale ? productOld : null,
      stock: Math.max(0, Math.floor(stockByVariant.get(product.id) ?? 0)),
    })
  }

  const order = sortSizes(mappedVariants.map((v) => v.size))
  mappedVariants.sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size))

  const prices = mappedVariants.map((v) => v.price).filter((p) => p > 0)
  const minPrice = prices.length ? Math.min(...prices) : 0
  if (!minPrice) problems.push("Нет цены продажи")
  if (!brandMatch) problems.push("Бренд не определён")
  if (!color) problems.push("Цвет не определён")

  return {
    moyskladId: product.id,
    title,
    handleBase: slugify(title),
    folderId: idFromHref(product.productFolder?.meta.href),
    brand: brandMatch?.brand ?? null,
    gender: detectGender(title, attr(product, opts.attrGender)),
    color,
    colorName: color ? COLOR_NAMES[color] : null,
    description: product.description?.trim() || null,
    oldSiteUrl: attr(product, opts.attrOldUrl),
    variants: mappedVariants,
    sizes: order,
    totalStock: mappedVariants.reduce((s, v) => s + v.stock, 0),
    preorder: /^(true|да|yes|1)$/i.test(attr(product, opts.attrPreorder) ?? ""),
    minPrice,
    problems,
  }
}
