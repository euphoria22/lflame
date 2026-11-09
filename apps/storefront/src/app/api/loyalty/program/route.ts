import { NextResponse } from "next/server"

import { storeFetch } from "@/lib/store-api"

/** Уровни LAFLAMME Club для прогресса в корзине у гостя. */
export async function GET() {
  try {
    const p = await storeFetch<{ enabled: boolean; tiers: { code: string; name: string; threshold: number; discount: number }[] }>("/store/loyalty/program")
    return NextResponse.json({ enabled: p.enabled, tiers: p.tiers })
  } catch {
    return NextResponse.json({ enabled: false, tiers: [] })
  }
}
