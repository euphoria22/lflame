import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createCartCreditLinesWorkflow, deleteCartCreditLinesWorkflow, refreshPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { applicable, findByCode, usable } from "./engine"
import { formatCode, normalizeCode } from "./rules"

/**
 * Оплата заказа подарочной картой на сайте. Карта — «кредитная строка» корзины Medusa:
 * уменьшает сумму к оплате, не меняя цены товаров (скидки, Club и акции считаются как обычно).
 * Код хранится в metadata корзины (gift_card_code); строка создаётся прямо перед оплатой (applyToCart),
 * деньги списываются с карты, когда заказ создан (подписчик order.placed), и возвращаются при отмене.
 */
export const GIFT_REFERENCE = "gift_card"

type CartRow = {
  id: string
  total: number
  completed_at: string | null
  metadata: Record<string, unknown> | null
  credit_lines?: { id: string; amount: number; reference: string | null }[] | null
}

async function readCart(c: MedusaContainer, cartId: string): Promise<CartRow> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "cart", fields: ["id", "total", "completed_at", "metadata", "credit_lines.id", "credit_lines.amount", "credit_lines.reference"], filters: { id: cartId } })
  const cart = data[0] as unknown as CartRow | undefined
  if (!cart || cart.completed_at) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Корзина не найдена")
  return cart
}

const giftLines = (cart: CartRow) => (cart.credit_lines ?? []).filter((l) => l.reference === GIFT_REFERENCE)

/** Сумма к оплате без карты (если строка карты уже стоит — прибавляем её обратно) */
const totalWithoutGift = (cart: CartRow) => Number(cart.total) + giftLines(cart).reduce((s, l) => s + Number(l.amount), 0)

export type CartGift = { code: string; balance: number; applied: number; expires_at: Date | null } | null

/** Сохранить код карты в корзине (null — убрать). Возвращает, сколько спишется сейчас. */
export async function setCartGiftCard(c: MedusaContainer, cartId: string, code: string | null): Promise<CartGift> {
  const cart = await readCart(c, cartId)
  const cartModule = c.resolve(Modules.CART)
  if (!code) {
    if (giftLines(cart).length) await deleteCartCreditLinesWorkflow(c).run({ input: { id: giftLines(cart).map((l) => l.id) } })
    await cartModule.updateCarts(cartId, { metadata: { ...(cart.metadata ?? {}), gift_card_code: null } })
    return null
  }
  const card = await findByCode(c, code)
  const u = usable(card)
  if (!u.ok) throw new MedusaError(MedusaError.Types.INVALID_DATA, u.reason)
  await cartModule.updateCarts(cartId, { metadata: { ...(cart.metadata ?? {}), gift_card_code: card!.code } })
  return { code: formatCode(card!.code), balance: card!.balance, applied: applicable(card!.balance, totalWithoutGift(cart)), expires_at: card!.expires_at }
}

/** Карта в корзине — для сводки заказа */
export async function cartGiftCard(c: MedusaContainer, cartId: string): Promise<CartGift> {
  const cart = await readCart(c, cartId)
  const code = typeof cart.metadata?.gift_card_code === "string" ? cart.metadata.gift_card_code : null
  if (!code) return null
  const card = await findByCode(c, code)
  if (!usable(card).ok) return null
  return { code: formatCode(card!.code), balance: card!.balance, applied: applicable(card!.balance, totalWithoutGift(cart)), expires_at: card!.expires_at }
}

/**
 * Перед оплатой: поставить строку карты на актуальную сумму (корзина могла измениться) и обновить сумму платежа.
 * Возвращает списываемую сумму (0 — карты нет или она уже не действует).
 */
export async function applyToCart(c: MedusaContainer, cartId: string): Promise<number> {
  const cart = await readCart(c, cartId)
  const old = giftLines(cart)
  if (old.length) await deleteCartCreditLinesWorkflow(c).run({ input: { id: old.map((l) => l.id) } })
  const code = typeof cart.metadata?.gift_card_code === "string" ? normalizeCode(cart.metadata.gift_card_code) : null
  let amount = 0
  if (code) {
    const card = await findByCode(c, code)
    if (!usable(card).ok) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Подарочная карта: ${(usable(card) as { reason: string }).reason}`)
    amount = applicable(card!.balance, totalWithoutGift(cart))
    if (amount > 0) {
      await createCartCreditLinesWorkflow(c).run({
        input: [{ cart_id: cartId, amount, reference: GIFT_REFERENCE, reference_id: card!.id, metadata: { code: card!.code } }],
      })
    }
  }
  await refreshPaymentCollectionForCartWorkflow(c).run({ input: { cart_id: cartId } }).catch(() => null)
  return amount
}
