/** Проверка данных оформления: используется и в форме, и на сервере. */
export type CheckoutInput = {
  first_name: string
  last_name: string
  phone: string
  email: string
  comment?: string
  consent: boolean
  marketing?: boolean
}

/** Телефон РФ к виду +7XXXXXXXXXX; null — неверный номер. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "")
  if (d.length === 11 && (d.startsWith("8") || d.startsWith("7"))) d = d.slice(1)
  return d.length === 10 && d.startsWith("9") ? `+7${d}` : null
}

export function validateCheckout(v: Partial<CheckoutInput>): Record<string, string> {
  const e: Record<string, string> = {}
  if (!v.first_name?.trim()) e.first_name = "Укажите имя"
  if (!v.last_name?.trim()) e.last_name = "Укажите фамилию"
  if (!v.phone || !normalizePhone(v.phone)) e.phone = "Укажите мобильный номер: +7 9XX XXX-XX-XX"
  if (!v.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = "Укажите email: на него придёт подтверждение"
  if (!v.consent) e.consent = "Нужно согласие на обработку персональных данных"
  return e
}

/** Способ оплаты: онлайн (Т-Касса), предоплата по ссылке от менеджера, при получении. */
export type PaymentMethod = "tbank" | "manual" | "cod"
