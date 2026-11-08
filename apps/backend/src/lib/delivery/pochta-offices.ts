import { MedusaError } from "@medusajs/framework/utils"

/**
 * Отделения Почты России рядом с точкой — API «Отправка» (otpravka.pochta.ru).
 * Нужны: токен приложения (POCHTA_TOKEN) и логин/пароль кабинета «Отправка» (POCHTA_LOGIN / POCHTA_PASSWORD).
 * Без них отделения на карте не показываются — покупатель вводит индекс вручную.
 */
export type PochtaOffice = { code: string; postal_code: string; address: string; lat: number; lon: number; work_time: string; type: string }

export function pochtaOfficesEnabled(): boolean {
  return Boolean(process.env.POCHTA_TOKEN && process.env.POCHTA_LOGIN && process.env.POCHTA_PASSWORD)
}

const DAYS = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

type RawOffice = {
  "postal-code"?: string
  "address-source"?: string
  latitude?: number | string
  longitude?: number | string
  "type-code"?: string
  "is-temporary-closed"?: boolean
  "is-closed"?: boolean
  "working-hours"?: { "weekday-id"?: number; "begin-worktime"?: string; "end-worktime"?: string }[]
}

/** «Пн 08:00–20:00, Вт 08:00–20:00 …» -> сжимаем одинаковые дни. */
export function formatHours(rows: RawOffice["working-hours"]): string {
  const days = (rows ?? [])
    .filter((r) => r["weekday-id"] && r["begin-worktime"] && r["end-worktime"])
    .map((r) => ({ d: r["weekday-id"] as number, t: `${r["begin-worktime"]!.slice(0, 5)}–${r["end-worktime"]!.slice(0, 5)}` }))
    .sort((a, b) => a.d - b.d)
  const groups: { from: number; to: number; t: string }[] = []
  for (const x of days) {
    const g = groups[groups.length - 1]
    if (g && g.t === x.t && g.to === x.d - 1) g.to = x.d
    else groups.push({ from: x.d, to: x.d, t: x.t })
  }
  return groups.map((g) => `${DAYS[g.from]}${g.to !== g.from ? `–${DAYS[g.to]}` : ""} ${g.t}`).join(", ")
}

export function mapOffice(o: RawOffice): PochtaOffice | null {
  const index = o["postal-code"]
  if (!index || o["is-closed"] || o["is-temporary-closed"]) return null
  return {
    code: index,
    postal_code: index,
    address: o["address-source"] ?? "",
    lat: Number(o.latitude),
    lon: Number(o.longitude),
    work_time: formatHours(o["working-hours"]),
    type: o["type-code"] ?? "",
  }
}

export async function pochtaOfficesNear(lat: number, lon: number): Promise<PochtaOffice[]> {
  if (!pochtaOfficesEnabled()) return []
  const url = new URL("https://otpravka-api.pochta.ru/postoffice/1.0/nearby")
  url.searchParams.set("latitude", String(lat))
  url.searchParams.set("longitude", String(lon))
  url.searchParams.set("top", "60")
  url.searchParams.set("search-radius", "25")
  url.searchParams.set("filter", "ALL")
  url.searchParams.set("current-date-time", new Date().toISOString().slice(0, 19))
  const basic = Buffer.from(`${process.env.POCHTA_LOGIN}:${process.env.POCHTA_PASSWORD}`).toString("base64")
  const res = await fetch(url, {
    headers: {
      Authorization: `AccessToken ${process.env.POCHTA_TOKEN}`,
      "X-User-Authorization": `Basic ${basic}`,
      Accept: "application/json;charset=UTF-8",
    },
  })
  if (!res.ok) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Почта ${res.status}: отделения недоступны`)
  const rows = (await res.json()) as RawOffice[]
  return rows.map(mapOffice).filter((o): o is PochtaOffice => Boolean(o))
}
