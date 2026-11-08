import { NextRequest, NextResponse } from "next/server"

import { storeFetch } from "@/lib/store-api"

export async function GET(req: NextRequest) {
  const code = Number(req.nextUrl.searchParams.get("city_code"))
  if (!code) return NextResponse.json({ points: [] })
  try {
    return NextResponse.json(await storeFetch(`/store/delivery/cdek/points?city_code=${code}`))
  } catch {
    return NextResponse.json({ points: [] }, { status: 502 })
  }
}
