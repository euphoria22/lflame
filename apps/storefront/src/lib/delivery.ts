/** Способы получения на витрине (совпадают с type.code способов доставки в Medusa). */
export type DeliveryKind = "pickup" | "cdek-pvz" | "cdek-door" | "pochta"

export type CdekCity = { code: number; city: string; full_name: string }
export type CdekPoint = { code: string; name: string; address: string; full_address: string; work_time: string; postal_code: string }
export type Quote = { amount: number; days_min: number; days_max: number; full_amount?: number; free?: boolean }

/** Данные выбранной доставки, которые форма отправляет при оформлении. */
export type DeliveryChoice = {
  kind: DeliveryKind
  city?: string
  city_code?: number
  pvz_code?: string
  pvz_address?: string
  postal_code?: string
  address?: string
}

export const PICKUP = {
  title: "Самовывоз из магазина",
  address: "Омск, ул. Партизанская, 5а/8",
  hours: "ежедневно с 12:00 до 21:00",
}

export function daysLabel(q: Quote): string {
  return q.days_min === q.days_max ? `${q.days_min} дн.` : `${q.days_min}–${q.days_max} дн.`
}

/** Проверка выбора доставки (общая для формы и сервера). */
export function validateDelivery(d: Partial<DeliveryChoice> | undefined): string | null {
  if (!d?.kind) return "Выберите способ получения"
  if (d.kind === "pickup") return null
  if ((d.kind === "cdek-pvz" || d.kind === "cdek-door") && !d.city_code) return "Выберите город"
  if (d.kind === "cdek-pvz" && !d.pvz_code) return "Выберите пункт выдачи"
  if ((d.kind === "cdek-door" || d.kind === "pochta") && !d.address?.trim()) return "Укажите адрес"
  if (d.kind === "pochta" && !/^\d{6}$/.test(d.postal_code ?? "")) return "Укажите индекс: 6 цифр"
  if (d.kind === "pochta" && !d.city?.trim()) return "Укажите город"
  return null
}
