import { NextRequest, NextResponse } from "next/server"

import { getCatalog } from "@/lib/catalog"
import { parseFilters, runListing, scopeFromQuery, scopeItems } from "@/lib/listing"

/** Следующая страница листинга для кнопки «Показать ещё» (данные из кэша каталога). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const filters = parseFilters(Object.fromEntries(sp.entries()))
  const result = runListing(scopeItems(await getCatalog(), scopeFromQuery(sp)), filters)
  return NextResponse.json({ items: result.items, page: result.page, pages: result.pages })
}
