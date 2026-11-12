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
/**
 * Маска при вводе: «+7 (913) 144-64-82». Принимает 8…, 7…, +7… и 9… — приводит к +7.
 * Пустая строка остаётся пустой, чтобы поле можно было очистить.
 */
export function formatPhoneInput(raw: string, prev = ""): string {
  let d = raw.replace(/\D/g, "")
  // Стёрли скобку, пробел или дефис — маска вернула бы их обратно, и дальше не стереть. Убираем цифру перед ними
  if (prev && raw.length < prev.length && raw.replace(/\D/g, "") === prev.replace(/\D/g, "")) d = d.slice(0, -1)
  if (!d) return ""
  if (d.startsWith("8") || d.startsWith("7")) d = d.slice(1)
  d = d.slice(0, 10)
  let out = "+7"
  if (d.length) out += ` (${d.slice(0, 3)}`
  if (d.length >= 3) out += ")"
  if (d.length > 3) out += ` ${d.slice(3, 6)}`
  if (d.length > 6) out += `-${d.slice(6, 8)}`
  if (d.length > 8) out += `-${d.slice(8, 10)}`
  return out
}

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
export type PaymentMethod = "tbank" | "split" | "manual" | "cod"
