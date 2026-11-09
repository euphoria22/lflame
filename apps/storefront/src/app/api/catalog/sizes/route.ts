import { NextRequest, NextResponse } from "next/server"

import { getCatalog } from "@/lib/catalog"

/** Размеры товаров по адресам (для смены размера в корзине). */
export async function GET(req: NextRequest) {
  const handles = new Set((req.nextUrl.searchParams.get("h") ?? "").split(",").filter((h) => /^[a-z0-9-]{1,200}$/.test(h)).slice(0, 100))
  const catalog = await getCatalog()
  const out: Record<string, { size: string; in_stock: boolean; variant_id?: string }[]> = {}
  for (const i of catalog) if (handles.has(i.handle)) out[i.handle] = i.sizes
  return NextResponse.json({ sizes: out })
}
