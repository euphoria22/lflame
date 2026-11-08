/** Корзина в виде, нужном витрине (собирается из ответа Medusa). */
export type CartLine = {
  id: string
  variant_id: string
  title: string
  size: string
  handle: string | null
  thumbnail: string | null
  quantity: number
  unit_price: number
  total: number
}

export type Cart = {
  id: string
  lines: CartLine[]
  count: number
  item_total: number
  shipping_total: number
  total: number
}
