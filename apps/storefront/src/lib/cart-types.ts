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
  /** Цена без скидки уровня (если скидка применена) */
  base_price: number | null
}

export type Cart = {
  id: string
  lines: CartLine[]
  count: number
  /** Товары к оплате (после скидки LAFLAMME и промокода) */
  item_total: number
  /** Сумма товаров для порога бесплатной доставки и прогресса уровня (после всех скидок) */
  goods_total: number
  shipping_total: number
  total: number
  /** Скидка программы лояльности в корзине */
  loyalty: { level: string; pct: number; saved: number } | null
  /** Промокод: applied=false — введён, но скидка LAFLAMME выгоднее (не суммируются) */
  promo: { code: string; applied: boolean; saved: number; note: string | null } | null
}
