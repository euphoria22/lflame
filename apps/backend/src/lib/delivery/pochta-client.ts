import { MedusaError } from "@medusajs/framework/utils"

/**
 * Расчёт доставки Почтой России через открытый калькулятор tariff.pochta.ru (без ключа).
 * Создание отправлений (API otpravka.pochta.ru) — после договора с Почтой.
 */
export function pochtaFromIndex(): string {
  return process.env.POCHTA_FROM_INDEX || "644007"
}

/** Посылка стандартная (код объекта 27030 в калькуляторе Почты). */
const POCHTA_PARCEL_OBJECT = 27030

export type PochtaQuote = { amount: number; days_min: number; days_max: number }

export async function pochtaQuote(toIndex: string, weightGrams: number): Promise<PochtaQuote> {
  if (!/^\d{6}$/.test(toIndex)) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Почта: неверный индекс")
  const url = `https://tariff.pochta.ru/v2/calculate/tariff/delivery?json&object=${POCHTA_PARCEL_OBJECT}&from=${pochtaFromIndex()}&to=${toIndex}&weight=${Math.max(100, Math.round(weightGrams))}&pack=10`
  const res = await fetch(url)
  const d = (await res.json().catch(() => ({}))) as { paynds?: number; delivery?: { min?: number; max?: number }; errors?: { msg?: string }[]; error?: string[] }
  if (!res.ok || !d.paynds) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Почта: ${d.errors?.[0]?.msg ?? d.error?.[0] ?? `расчёт недоступен (${res.status})`}`)
  return { amount: Math.ceil(d.paynds / 100), days_min: (d.delivery?.min ?? 0) + 1, days_max: (d.delivery?.max ?? 0) + 1 }
}
