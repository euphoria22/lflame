import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Цена с учётом автоматических акций («Промоакции» в админке без промокода, например 11.11: −25% на MISBHV и YEEZY).
 * Medusa применяет их только в корзине; здесь та же логика условий, чтобы показать цену в постах Telegram
 * и подсказках. Условия на товары: коллекция (бренд), теги, категория, тип, сам товар — операторы in / eq / ne.
 * Акции с условиями на корзину или покупателя (группа клиентов и т. п.) не считаются — они не для всех.
 */

export type AutoPromo = {
  id: string
  /** Название кампании или код акции — для подписи «по акции 11.11» */
  label: string
  type: "percentage" | "fixed"
  value: number
  rules: { attribute: string; operator: string; values: string[] }[]
}

export type PromoProduct = {
  id: string
  collection_id: string | null
  type_id: string | null
  tag_ids: string[]
  category_ids: string[]
  /** Поле Medusa «Скидки»: выключено — акции не действуют */
  discountable: boolean
}

export type PromoPrice = { price: number; label: string; pct: number }

/** Значения товара для атрибута правила акции */
function productValues(p: PromoProduct, attribute: string): string[] | null {
  switch (attribute.replace(/^items\./, "")) {
    case "product.id":
    case "product_id": return [p.id]
    case "product.collection_id":
    case "product.collection.id": return p.collection_id ? [p.collection_id] : []
    case "product.type_id":
    case "product.type.id": return p.type_id ? [p.type_id] : []
    case "product.tags.id":
    case "product.tags": return p.tag_ids
    case "product.categories.id":
    case "product.categories": return p.category_ids
    default: return null
  }
}

/** Подходит ли товар под условия акции (все условия должны выполняться) */
export function matches(p: PromoProduct, promo: AutoPromo): boolean {
  if (!p.discountable) return false
  return promo.rules.every((r) => {
    const have = productValues(p, r.attribute)
    if (have === null) return false
    if (r.operator === "ne") return !have.some((v) => r.values.includes(v))
    return have.some((v) => r.values.includes(v))
  })
}

/** Лучшая цена товара по действующим акциям (если подходит несколько — самая выгодная для покупателя) */
export function autoPrice(price: number, p: PromoProduct, promos: AutoPromo[]): PromoPrice | null {
  let best: PromoPrice | null = null
  for (const promo of promos) {
    if (!matches(p, promo)) continue
    const after = promo.type === "percentage" ? price * (1 - Math.min(promo.value, 100) / 100) : Math.max(0, price - promo.value)
    const rounded = Math.round(after)
    if (rounded < price && (!best || rounded < best.price)) {
      best = { price: rounded, label: promo.label, pct: Math.round((1 - rounded / price) * 100) }
    }
  }
  return best
}

type Row = {
  id: string
  code: string
  is_automatic: boolean
  status: string
  campaign?: { name?: string | null; starts_at?: string | Date | null; ends_at?: string | Date | null } | null
  rules?: { attribute: string }[] | null
  application_method?: {
    type: string
    target_type: string
    value: unknown
    target_rules?: { attribute: string; operator: string; values?: { value: string }[] | null }[] | null
  } | null
}

let cache: { at: number; promos: AutoPromo[] } | null = null

/** Действующие сейчас автоматические акции на товары (кэш на минуту) */
export async function activeAutoPromos(container: MedusaContainer, now = new Date()): Promise<AutoPromo[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.promos
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "promotion",
    fields: [
      "id", "code", "is_automatic", "status",
      "campaign.name", "campaign.starts_at", "campaign.ends_at",
      "rules.attribute",
      "application_method.type", "application_method.target_type", "application_method.value",
      "application_method.target_rules.attribute", "application_method.target_rules.operator", "application_method.target_rules.values.value",
    ],
    filters: { is_automatic: true },
  })
  const promos = (data as unknown as Row[])
    .filter((r) => r.status === "active")
    .filter((r) => {
      const s = r.campaign?.starts_at ? new Date(r.campaign.starts_at).getTime() : null
      const e = r.campaign?.ends_at ? new Date(r.campaign.ends_at).getTime() : null
      return (s === null || s <= now.getTime()) && (e === null || e >= now.getTime())
    })
    // Только скидки на товары и без условий на корзину/покупателя (валюта — можно)
    .filter((r) => r.application_method?.target_type === "items" && (r.rules ?? []).every((x) => /currency_code|region/.test(x.attribute)))
    .filter((r) => r.application_method?.type === "percentage" || r.application_method?.type === "fixed")
    .map((r): AutoPromo => ({
      id: r.id,
      label: r.campaign?.name?.trim() || r.code,
      type: r.application_method!.type as AutoPromo["type"],
      value: Number(r.application_method!.value ?? 0),
      rules: (r.application_method!.target_rules ?? []).map((t) => ({ attribute: t.attribute, operator: t.operator, values: (t.values ?? []).map((v) => v.value) })),
    }))
    .filter((p) => p.value > 0)
  cache = { at: Date.now(), promos }
  return promos
}

/** Данные товаров для проверки условий акций */
export async function promoProducts(container: MedusaContainer, ids: string[]): Promise<Map<string, PromoProduct>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const out = new Map<string, PromoProduct>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "collection_id", "type_id", "discountable", "tags.id", "categories.id"],
      filters: { id: ids.slice(i, i + 500) },
    })
    for (const r of data as { id: string; collection_id?: string | null; type_id?: string | null; discountable?: boolean | null; tags?: { id: string }[] | null; categories?: { id: string }[] | null }[]) {
      out.set(r.id, {
        id: r.id, collection_id: r.collection_id ?? null, type_id: r.type_id ?? null, discountable: r.discountable !== false,
        tag_ids: (r.tags ?? []).map((t) => t.id), category_ids: (r.categories ?? []).map((c) => c.id),
      })
    }
  }
  return out
}
