/** Типы личного кабинета (общие для сервера и браузера). */

export type AccountItem = { id: string; title: string; size: string; quantity: number; price: number; compare_at: number | null; thumbnail: string | null; handle: string | null }
export type AccountOrder = {
  id: string
  number: number
  created_at: string
  status: { code: string; label: string; group: "done" | "active" | "canceled" }
  total: number
  shipping_total: number
  goods: number
  discount: number
  promo_code: string | null
  paid_online: boolean
  paid: boolean
  payment_method: string | null
  delivery: string
  address: string
  recipient: { name: string; phone: string; email: string }
  tracking: { number: string; url: string } | null
  items: AccountItem[]
}
export type AccountCustomer = { email: string; first_name: string | null; last_name: string | null; phone: string | null; birth_date: string | null }
export type Tier = { code: string; name: string; threshold: number; discount: number }
export type LoyaltyStatus = {
  enabled: boolean
  phone: string | null
  confirmed: boolean
  level: Tier
  total: number
  next: Tier | null
  to_next: number
  tiers: Tier[]
  forecast: { level: string; future: string; need: number; until: string } | null
  pending: number
  history: { date: string; title: string; amount: number; status: string; source: string }[]
}
