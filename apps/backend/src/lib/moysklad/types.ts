/** Минимальные типы JSON API МоегоСклада 1.2, которые использует сайт. */
export type MsMeta = { href: string; type?: string; size?: number; downloadHref?: string }

export type MsAttribute = { id: string; name: string; type: string; value?: unknown }

export type MsSalePrice = { value: number; priceType: { name: string } }

export type MsProduct = {
  id: string
  name: string
  code?: string
  article?: string
  description?: string
  archived: boolean
  updated: string
  pathName?: string
  productFolder?: { meta: MsMeta }
  attributes?: MsAttribute[]
  salePrices?: MsSalePrice[]
  barcodes?: Record<string, string>[]
  weight?: number
  volume?: number
  variantsCount?: number
  images?: { meta: MsMeta }
}

export type MsVariant = {
  id: string
  name: string
  code?: string
  archived: boolean
  updated: string
  characteristics?: { name: string; value: string }[]
  salePrices?: MsSalePrice[]
  barcodes?: Record<string, string>[]
  product: { meta: MsMeta }
}

export type MsFolder = { id: string; name: string; pathName?: string; archived?: boolean; meta: MsMeta }

export type MsImage = { filename: string; title?: string; meta: MsMeta; updated?: string }

export type MsStore = { id: string; name: string; meta: MsMeta }

export type MsStockRow = { assortmentId: string; storeId: string; freeStock?: number; quantity?: number; stock?: number }

/** id сущности из href ("…/entity/product/<id>" -> "<id>"). */
export function idFromHref(href: string | undefined): string | null {
  if (!href) return null
  const m = href.match(/\/([0-9a-f-]{36})(?:\?|$)/)
  return m ? m[1] : null
}
