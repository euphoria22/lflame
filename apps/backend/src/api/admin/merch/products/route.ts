import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadCatalogItems } from "../../../../lib/catalog/store-catalog"
import { MProduct } from "../../../../lib/merch/autofill"
import { attachScores } from "../../../../lib/sort/engine"

const FRESH_MS = 21 * 86_400_000

/** Товары в наличии для раскладки по залу: категория, бренд, цвет, размеры, балл умной сортировки */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const items = await attachScores(req.scope, (await loadCatalogItems(req.scope)).filter((i) => i.in_stock && !i.preorder))
  const products: MProduct[] = items.map((i) => ({
    id: i.id, title: i.title, brand: i.brand?.name ?? null, cat: i.category?.handle ?? null, sub: i.subtype?.name ?? null,
    color: i.color, thumb: i.thumbnail, sizes: i.sizes.filter((s) => s.in_stock).map((s) => s.size),
    score: i.score ?? 0, price: i.price, units: i.stock_units ?? 0, warmth: i.warmth ?? null,
    model: i.model ?? null, outlet: i.outlet,
    // Новинка: отмечена вручную или пришла за последние 3 недели (не с первой загрузкой каталога)
    fresh: i.new_manual || (!i.initial_import && Date.now() - Date.parse(i.created_at) < FRESH_MS),
  }))
  res.json({ products })
}
