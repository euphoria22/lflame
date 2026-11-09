import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"
import { discountFor, getLoyaltySettings } from "./engine"
import { loyaltyPrice } from "./rules"

type CartItem = { id: string; variant_id: string | null; quantity: number; unit_price: unknown; is_custom_price?: boolean; metadata?: Record<string, unknown> | null }
type VariantRow = { id: string; metadata?: Record<string, unknown> | null; prices?: { amount: unknown; currency_code: string }[]; product?: { brand?: { name?: string } | null } | null }

export type CartLoyalty = { level: string; pct: number; saved: number } | null

/**
 * Скидка уровня в корзине (ТЗ, п. 6.7): считается только на сервере, по правилу «большая из двух»,
 * без брендов-исключений. Цена строки ставится заново при каждом изменении корзины;
 * без входа (или без уровня) — возвращается обычная цена.
 */
export async function applyCartLoyalty(c: MedusaContainer, cartId: string, customerId: string | null): Promise<CartLoyalty> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "currency_code", "customer_id", "completed_at", "items.id", "items.variant_id", "items.quantity", "items.unit_price", "items.is_custom_price", "items.metadata"],
    filters: { id: cartId },
  })
  const cart = data[0] as unknown as { id: string; currency_code: string; customer_id: string | null; completed_at: string | null; items?: CartItem[] } | undefined
  if (!cart || cart.completed_at || !cart.items?.length) return null

  // Скидка — только владельцу корзины
  let discount: Awaited<ReturnType<typeof discountFor>> = null
  if (customerId && cart.customer_id === customerId) {
    const customer = await c.resolve(Modules.CUSTOMER).retrieveCustomer(customerId)
    discount = await discountFor(c, { email: customer.email, phone: customer.phone })
  }
  const settings = await getLoyaltySettings()
  const excluded = new Set(settings.excluded_brands.map((b) => b.toLowerCase()))

  const ids = cart.items.map((i) => i.variant_id).filter(Boolean) as string[]
  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "metadata", "prices.amount", "prices.currency_code", "product.brand.name"],
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
    const pct = discount && !excluded.has(brand) ? discount.pct : 0
    const target = loyaltyPrice(price, compareAt, pct)
    const meta = { ...(item.metadata ?? {}) }
    const want = pct && target < price ? { level: discount!.tier.name, pct, base: price } : null
    saved += (price - target) * item.quantity
    const current = Number(item.unit_price)
    const sameMeta = JSON.stringify(meta.loyalty ?? null) === JSON.stringify(want)
    // Ничего не меняем, если цена и отметка уже верные (и обычная цена не была переопределена)
    if (current === target && sameMeta && (want || !item.is_custom_price)) continue
    if (!want && !item.is_custom_price && current === target) continue
    meta.loyalty = want
    await updateLineItemInCartWorkflow(c).run({
      input: { cart_id: cart.id, item_id: item.id, update: { quantity: item.quantity, unit_price: target, metadata: meta } },
    })
  }
  return discount && saved > 0 ? { level: discount.tier.name, pct: discount.pct, saved: Math.round(saved) } : null
}
