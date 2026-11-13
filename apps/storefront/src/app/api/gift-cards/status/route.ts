import { NextRequest, NextResponse } from "next/server"

import { storeFetch } from "@/lib/store-api"

/** Статус покупки подарочной карты — для страницы «Спасибо» после оплаты */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? ""
  if (!/^gc_[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
  try {
    return NextResponse.json(await storeFetch(`/store/gift-cards/status/${id}`), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 })
  }
}
