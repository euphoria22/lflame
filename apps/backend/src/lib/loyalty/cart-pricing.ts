import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, PromotionActions } from "@medusajs/framework/utils"
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { applyCartLoyalty, CartLoyalty } from "./cart"

export type CartPromo = { code: string; applied: boolean; saved: number; note: string | null } | null
export type CartPricing = { loyalty: CartLoyalty; promo: CartPromo; error?: string }

type CartRow = { id: string; completed_at: string | null; customer_id: string | null; metadata: Record<string, unknown> | null; discount_total: unknown; promotions?: { code: string | null }[]; items?: { adjustments?: { code?: string | null; amount?: unknown }[] | null }[] }

const normalize = (code: unknown) => String(code ?? "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 40) || null

async function load(c: MedusaContainer, cartId: string): Promise<CartRow | undefined> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "completed_at", "customer_id", "metadata", "discount_total", "promotions.code", "items.adjustments.code", "items.adjustments.amount"],
    filters: { id: cartId },
  })
  return data[0] as unknown as CartRow | undefined
}

async function setPromotions(c: MedusaContainer, cartId: string, codes: string[]) {
  await updateCartPromotionsWorkflow(c).run({ input: { cart_id: cartId, promo_codes: codes, action: PromotionActions.REPLACE } })
}

async function setCode(c: MedusaContainer, cart: CartRow, code: string | null) {
  if ((cart.metadata?.promo_code ?? null) === code) return
  await c.resolve(Modules.CART).updateCarts(cart.id, { metadata: { ...(cart.metadata ?? {}), promo_code: code } })
}

/**
 * Цены корзины: скидка уровня LAFLAMME или промокод — не суммируются, действует выгодная покупателю.
 * Введённый код хранится в metadata.promo_code и пересматривается при каждом изменении корзины
 * (поменялись товары, покупатель вошёл в кабинет). `code`: строка — применить, null — убрать, undefined — как было.
 */
export async function priceCart(c: MedusaContainer, cartId: string, customerId: string | null, code?: string | null): Promise<CartPricing> {
  let cart = await load(c, cartId)
  if (!cart || cart.completed_at) return { loyalty: null, promo: null }
  const wanted = code === undefined ? normalize(cart.metadata?.promo_code) : normalize(code)
  const active = (cart.promotions ?? []).map((p) => p.code).filter(Boolean)

  if (!wanted) {
    if (active.length) await setPromotions(c, cartId, [])
    await setCode(c, cart, null)
    return { loyalty: await applyCartLoyalty(c, cartId, customerId), promo: null }
  }

  // Сколько дала бы скидка уровня (без изменений в корзине)
  const potential = (await applyCartLoyalty(c, cartId, customerId, { dryRun: true }))?.saved ?? 0

  // Промокод считается от обычных цен
  await applyCartLoyalty(c, cartId, customerId, { off: true })
  let error: string | undefined
  try {
    await setPromotions(c, cartId, [wanted])
  } catch {
    error = "Такого промокода нет или он больше не действует"
  }
  cart = (await load(c, cartId))!
  const applied = (cart.promotions ?? []).some((p) => p.code?.toUpperCase() === wanted)
  // Только скидка по промокоду (без автоматических акций)
  const saved = applied ? Math.round((cart.items ?? []).flatMap((i) => i.adjustments ?? []).filter((a) => String(a.code ?? "").toUpperCase() === wanted).reduce((s, a) => s + Number(a.amount ?? 0), 0)) : 0
  if (!error && (!applied || saved <= 0)) error = "Промокод не действует на товары в корзине"

  if (error) {
    if ((cart.promotions ?? []).length) await setPromotions(c, cartId, [])
    await setCode(c, cart, null)
    return { loyalty: await applyCartLoyalty(c, cartId, customerId), promo: null, error }
  }

  await setCode(c, cart, wanted)
  if (potential > saved) {
    // Скидка уровня выгоднее: промокод снимаем, код помним (вдруг корзина изменится)
    await setPromotions(c, cartId, [])
    const loyalty = await applyCartLoyalty(c, cartId, customerId)
    return { loyalty, promo: { code: wanted, applied: false, saved, note: `Скидка ${loyalty ? `Laflamme Club ${loyalty.level}` : "Laflamme Club"} выгоднее — применили её` } }
  }
  return { loyalty: null, promo: { code: wanted, applied: true, saved, note: null } }
}
