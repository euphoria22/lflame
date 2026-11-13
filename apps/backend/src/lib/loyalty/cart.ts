import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"
import { discountFor, getLoyaltySettings } from "./engine"
import { loyaltyPrice } from "./rules"

type CartItem = { id: string; variant_id: string | null; quantity: number; unit_price: unknown; is_custom_price?: boolean; metadata?: Record<string, unknown> | null; adjustments?: { code?: string | null; amount?: unknown }[] | null }
type VariantRow = { id: string; metadata?: Record<string, unknown> | null; prices?: { amount: unknown; currency_code: string }[]; product?: { brand?: { name?: string } | null; metadata?: Record<string, unknown> | null; discountable?: boolean | null } | null }

/** На строку действует автоматическая акция Medusa: есть скидка не от введённого покупателем промокода. */
export function hasAutoPromo(item: Pick<CartItem, "adjustments">, cartMeta?: Record<string, unknown> | null): boolean {
  const code = String(cartMeta?.promo_code ?? "").toUpperCase()
  return (item.adjustments ?? []).some((a) => Number(a.amount ?? 0) > 0 && String(a.code ?? "").toUpperCase() !== code)
}

export type CartLoyalty = { level: string; pct: number; saved: number } | null

/**
 * Скидка уровня в корзине (ТЗ, п. 6.7): считается только на сервере, по правилу «большая из двух»,
 * без брендов-исключений. Цена строки ставится заново при каждом изменении корзины;
 * без входа (или без уровня) — возвращается обычная цена.
 * С промокодом не суммируется: какую скидку применить, решает cart-pricing.ts.
 */
export async function applyCartLoyalty(c: MedusaContainer, cartId: string, customerId: string | null, opts: { off?: boolean; dryRun?: boolean } = {}): Promise<CartLoyalty> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "currency_code", "customer_id", "completed_at", "metadata", "items.id", "items.variant_id", "items.quantity", "items.unit_price", "items.is_custom_price", "items.metadata", "items.adjustments.code", "items.adjustments.amount"],
    filters: { id: cartId },
  })
  const cart = data[0] as unknown as { id: string; currency_code: string; customer_id: string | null; completed_at: string | null; metadata?: Record<string, unknown> | null; items?: CartItem[] } | undefined
  if (!cart || cart.completed_at || !cart.items?.length) return null

  // Скидка — только владельцу корзины
  let discount: Awaited<ReturnType<typeof discountFor>> = null
  // off — скидку уровня не ставить (действует промокод); dryRun — только посчитать, ничего не менять
  if (customerId && cart.customer_id === customerId && !opts.off) {
    const customer = await c.resolve(Modules.CUSTOMER).retrieveCustomer(customerId)
    discount = await discountFor(c, { email: customer.email, phone: customer.phone })
  }
  const settings = await getLoyaltySettings()
  const excluded = new Set(settings.excluded_brands.map((b) => b.toLowerCase()))

  const ids = cart.items.map((i) => i.variant_id).filter(Boolean) as string[]
  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "metadata", "prices.amount", "prices.currency_code", "product.brand.name", "product.metadata", "product.discountable"],
    filters: { id: ids },
  })
  const byId = new Map((variants as unknown as VariantRow[]).map((v) => [v.id, v]))

  let saved = 0
  for (const item of cart.items) {
    const v = item.variant_id ? byId.get(item.variant_id) : undefined
    if (!v) continue
    const price = Number(v.prices?.find((p) => p.currency_code === cart.currency_code)?.amount ?? item.unit_price)
    const compareAt = Number(v.metadata?.compare_at_price ?? 0) || null
    const brand = v.product?.brand?.name?.toLowerCase() ?? ""
    // Исключения: бренды из настроек, товары с флажком «Не действуют скидки лояльности»
    // и товары, на которые действует автоматическая акция (не суммируется со скидкой уровня, как и промокод)
    const pct = discount && !excluded.has(brand) && !v.product?.metadata?.no_loyalty && v.product?.discountable !== false && !hasAutoPromo(item, cart.metadata) ? discount.pct : 0
    const target = loyaltyPrice(price, compareAt, pct)
    const meta = { ...(item.metadata ?? {}) }
    const want = pct && target < price ? { level: discount!.tier.name, pct, base: price } : null
    saved += (price - target) * item.quantity
    if (opts.dryRun) continue
    const current = Number(item.unit_price)
    // Зачёркнутая цена товара — для сводки «Товаров на / Скидки на товары» (Store API не отдаёт metadata варианта)
    const compare = compareAt && compareAt > price ? compareAt : null
    const sameMeta = JSON.stringify(meta.loyalty ?? null) === JSON.stringify(want) && (meta.compare_at ?? null) === compare
    // Ничего не меняем, если цена и отметки уже верные (и обычная цена не была переопределена)
    if (current === target && sameMeta && (want || !item.is_custom_price)) continue
    meta.loyalty = want
    meta.compare_at = compare
    // Цену ставим, только если она меняется или была переопределена — иначе обновляем лишь отметки
    const priceChange = current !== target || (!!item.is_custom_price && !want)
    await updateLineItemInCartWorkflow(c).run({
      input: { cart_id: cart.id, item_id: item.id, update: { quantity: item.quantity, metadata: meta, ...(priceChange || want ? { unit_price: target } : {}) } },
    })
  }
  return discount && saved > 0 ? { level: discount.tier.name, pct: discount.pct, saved: Math.round(saved) } : null
}
