import { NextRequest, NextResponse } from "next/server"

import { getCatalog, getSort } from "@/lib/catalog"
import { parseFilters, runListing, scopeFromQuery, scopeItems, sortContext } from "@/lib/listing"

/** Следующая страница листинга для кнопки «Показать ещё» (данные из кэша каталога). v — версия порядка, в котором покупатель начал листать */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const filters = parseFilters(Object.fromEntries(sp.entries()))
  const scope = scopeFromQuery(sp)
  const [items, sort] = await Promise.all([getCatalog(), getSort()])
  const result = runListing(scopeItems(items, scope), filters, sortContext(scope, sort, sp.get("v") ?? undefined))
  return NextResponse.json({ items: result.items, page: result.page, pages: result.pages, offset: result.offset })
}
