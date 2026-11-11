/** Типы данных каталога: совпадают с ответами /store/catalog/* бэкенда. */
export type Ref = { handle: string; name: string }

export type CatalogItem = {
  id: string
  handle: string
  title: string
  brand: Ref | null
  category: Ref | null
  gender: "men" | "women" | "unisex" | string
  color: string | null
  color_name: string | null
  thumbnail: string | null
  hover_image: string | null
  price: number
  compare_at: number | null
  sizes: { size: string; in_stock: boolean; variant_id?: string }[]
  in_stock: boolean
  /** Предзаказ: размеры можно заказать без остатка */
  preorder?: boolean
  /** Ожидаемая дата поступления предзаказа, ГГГГ-ММ-ДД */
  preorder_date?: string | null
  /** Outlet: вещь с небольшим дефектом и его описание */
  outlet?: boolean
  outlet_note?: string | null
  /** Скидка программы лояльности не действует */
  no_loyalty?: boolean
  created_at: string
  /** Путь на старом сайте (для 301) */
  old_path?: string | null
  /** Вычисляется витриной при загрузке каталога */
  is_new?: boolean
  /** Сортировка «Популярные»: продажи за 60 дней, фото, описание, закрепление, итоговый балл */
  sales?: number
  images_count?: number
  has_description?: boolean
  pinned?: boolean
  rank?: number
  /** Флажок «Новинка» в админке */
  new_manual?: boolean
  /** Пришёл с первой загрузкой каталога — новинкой сам по себе не считается */
  initial_import?: boolean
}

export type CatalogVariant = {
  id: string
  size: string
  sku: string | null
  price: number
  compare_at: number | null
  available: number
}

export type CatalogProduct = CatalogItem & {
  description: string | null
  images: string[]
  variants: CatalogVariant[]
  brand_description: string | null
  /** Состав, крой, детали — строки «Ключ: значение» */
  specs?: string | null
  status: "published" | "draft"
  discontinued: boolean
  updated_at: string
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

export type Taxonomy = { brands: TaxonomyBrand[]; categories: TaxonomyCategory[] }
