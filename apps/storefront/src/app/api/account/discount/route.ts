import { NextResponse } from "next/server"

import { getAuthToken, storeFetch } from "@/lib/store-api"

type Status = { enabled: boolean; confirmed: boolean; level: { name: string; discount: number } }

/** «Ваша цена»: скидка уровня вошедшего покупателя и бренды-исключения. Без входа или без уровня — pct: 0. */
export async function GET() {
  const none = NextResponse.json({ pct: 0 }, { headers: { "Cache-Control": "no-store" } })
  const token = await getAuthToken()
  if (!token) return none
  try {
    const [{ loyalty }, program] = await Promise.all([
      storeFetch<{ loyalty: Status }>("/store/account/me/loyalty", { token }),
      storeFetch<{ excluded_brands?: string[] }>("/store/loyalty/program"),
    ])
    if (!loyalty.enabled || !loyalty.confirmed || !loyalty.level?.discount) return none
    return NextResponse.json(
      { pct: loyalty.level.discount, level: loyalty.level.name, excluded_brands: program.excluded_brands ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return none
  }
}
