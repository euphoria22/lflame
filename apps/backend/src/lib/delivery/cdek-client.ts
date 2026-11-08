import { MedusaError } from "@medusajs/framework/utils"

/**
 * Клиент API СДЭК v2 (ТЗ, п. 5). Токен OAuth кэшируется до истечения.
 * Тестовая среда: https://api.edu.cdek.ru/v2 и общедоступный тестовый аккаунт из документации СДЭК.
 * Боевая: https://api.cdek.ru/v2 и ключи из личного кабинета СДЭК (Интеграция).
 */
export type CdekConfig = { baseUrl: string; clientId: string; clientSecret: string; fromCityCode: number }

export function cdekConfig(): CdekConfig {
  return {
    baseUrl: (process.env.CDEK_API_URL || "https://api.edu.cdek.ru/v2").replace(/\/+$/, ""),
    clientId: process.env.CDEK_CLIENT_ID || "",
    clientSecret: process.env.CDEK_CLIENT_SECRET || "",
    // Омск (код города СДЭК)
    fromCityCode: Number(process.env.CDEK_FROM_CITY_CODE || 268),
  }
}

let token: { value: string; expires: number; key: string } | null = null

async function getToken(cfg: CdekConfig): Promise<string> {
  const key = `${cfg.baseUrl}:${cfg.clientId}`
  if (token && token.key === key && token.expires > Date.now() + 60_000) return token.value
  const url = `${cfg.baseUrl}/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}`
  const res = await fetch(url, { method: "POST" })
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!res.ok || !data.access_token) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `СДЭК: не удалось получить токен (${res.status})`)
  token = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000, key }
  return token.value
}

export async function cdekRequest<T>(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const cfg = cdekConfig()
  if (!cfg.clientId || !cfg.clientSecret) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "СДЭК: не заданы CDEK_CLIENT_ID / CDEK_CLIENT_SECRET")
  const url = new URL(`${cfg.baseUrl}${path}`)
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v))
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await getToken(cfg)}`, "Content-Type": "application/json" },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as T & { errors?: { message: string }[] }
  if (!res.ok) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `СДЭК ${res.status}: ${data.errors?.map((e) => e.message).join("; ") ?? ""}`)
  return data
}

/** Тарифы «Посылка»: 136 — склад-склад (до пункта выдачи), 137 — склад-дверь (курьер). */
export const CDEK_TARIFFS = { pvz: 136, door: 137 } as const

export type CdekQuote = { amount: number; days_min: number; days_max: number }

export async function cdekQuote(tariff: number, toCityCode: number, parcel: { weight: number; length: number; width: number; height: number }): Promise<CdekQuote> {
  const cfg = cdekConfig()
  const r = await cdekRequest<{ delivery_sum?: number; total_sum?: number; period_min?: number; period_max?: number; errors?: { message: string }[] }>("/calculator/tariff", {
    method: "POST",
    body: { tariff_code: tariff, from_location: { code: cfg.fromCityCode }, to_location: { code: toCityCode }, packages: [parcel] },
  })
  if (r.errors?.length || r.total_sum === undefined) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `СДЭК: ${r.errors?.[0]?.message ?? "тариф недоступен"}`)
  // Сроки СДЭК — без дня передачи посылки; +1 день на сборку заказа
  return { amount: Math.ceil(r.total_sum), days_min: (r.period_min ?? 0) + 1, days_max: (r.period_max ?? 0) + 1 }
}

export type CdekCity = { code: number; city: string; full_name: string }
export type CdekPoint = { code: string; name: string; address: string; full_address: string; work_time: string; postal_code: string; lat: number; lon: number }

export async function cdekSuggestCities(q: string): Promise<CdekCity[]> {
  const rows = await cdekRequest<{ code: number; city?: string; full_name: string }[]>("/location/suggest/cities", { query: { name: q, country_code: "RU" } })
  return rows.slice(0, 10).map((c) => ({ code: c.code, city: c.city ?? c.full_name.split(",")[0], full_name: c.full_name }))
}

export async function cdekPoints(cityCode: number): Promise<CdekPoint[]> {
  const rows = await cdekRequest<{
    code: string; name: string; work_time?: string
    location: { address: string; address_full: string; postal_code?: string; latitude: number; longitude: number }
  }[]>("/deliverypoints", { query: { city_code: cityCode, type: "PVZ", country_code: "RU" } })
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    address: p.location.address,
    full_address: p.location.address_full,
    work_time: p.work_time ?? "",
    postal_code: p.location.postal_code ?? "",
    lat: p.location.latitude,
    lon: p.location.longitude,
  }))
}
