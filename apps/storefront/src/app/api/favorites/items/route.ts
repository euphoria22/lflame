import { NextRequest, NextResponse } from "next/server"

import { getCatalog } from "@/lib/catalog"

/** Товары избранного по адресам (в порядке добавления). Снятые с продажи не возвращаются. */
export async function GET(req: NextRequest) {
  const handles = (req.nextUrl.searchParams.get("h") ?? "").split(",").filter((h) => /^[a-z0-9-]{1,200}$/.test(h)).slice(0, 300)
  const catalog = await getCatalog()
  const byHandle = new Map(catalog.map((i) => [i.handle, i]))
  return NextResponse.json({ items: handles.map((h) => byHandle.get(h)).filter(Boolean) })
}
