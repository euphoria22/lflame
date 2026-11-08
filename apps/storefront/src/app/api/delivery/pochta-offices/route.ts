import { NextRequest, NextResponse } from "next/server"

import { storeFetch } from "@/lib/store-api"

export async function GET(req: NextRequest) {
  const code = Number(req.nextUrl.searchParams.get("city_code")) || 0
  try {
    return NextResponse.json(await storeFetch(`/store/delivery/pochta/offices?city_code=${code}`))
  } catch {
    return NextResponse.json({ available: false, offices: [] }, { status: 502 })
  }
}
