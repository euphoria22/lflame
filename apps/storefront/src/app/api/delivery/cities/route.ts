import { NextRequest, NextResponse } from "next/server"

import { storeFetch } from "@/lib/store-api"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 60) ?? ""
  try {
    return NextResponse.json(await storeFetch(`/store/delivery/cdek/cities?q=${encodeURIComponent(q)}`))
  } catch {
    return NextResponse.json({ cities: [] }, { status: 502 })
  }
}
