import { MedusaContainer } from "@medusajs/framework/types"
import { SORT_MODULE } from "../../modules/sort"
import type SortModuleService from "../../modules/sort/service"
import { loadCatalogItems } from "../catalog/store-catalog"
import { attachScores } from "../sort/engine"
import { omskNow } from "../shifts/shifts"
import { MProduct } from "./autofill"
import { hitLine, offlineScore } from "./offline"
import { loadRetail, retailSummary } from "./retail"
import { loadMerchSettings } from "./settings"

const FRESH_MS = 21 * 86_400_000

/**
 * Товары для раскладки по залу: в наличии, не предзаказ. Балл — офлайн (продажи магазина, маржа, остаток,
 * размеры, новизна, сезон) или балл сайта — по настройке «Чем ранжировать»; без продаж магазина — балл сайта.
 */
export async function merchProducts(c: MedusaContainer): Promise<{ products: MProduct[]; source: "offline" | "site"; retail_days: number }> {
  const all = await loadCatalogItems(c)
  const items = await attachScores(c, all.filter((i) => i.in_stock && !i.preorder))
  const [settings, retailRows] = await Promise.all([loadMerchSettings(), loadRetail(c)])
  const sort = c.resolve<SortModuleService>(SORT_MODULE)
  const [scores, costs] = await Promise.all([
    sort.listSortProductScores({ zone: "central" }, { take: 1_000_000, select: ["product_id", "z"] }) as Promise<{ product_id: string; z: number }[]>,
    sort.listSortCardCosts({}, { take: 1_000_000, select: ["product_id", "cost_price"] }) as Promise<{ product_id: string; cost_price: number | null }[]>,
  ])
  // Сезонность — составляющая Z умной сортировки (0,1…1)
  const season = new Map(scores.map((r) => [r.product_id, r.z]))
  const cost = new Map(costs.map((r) => [r.product_id, r.cost_price]))
  const sum = retailSummary(retailRows, omskNow().date)
  const days = new Set(retailRows.map((r) => r.day)).size
  const useOffline = settings.score_source === "offline" && retailRows.length > 0
  const q = (i: (typeof items)[number]) => sum.get(i.external_id ?? "") ?? { q30: 0, q60: 0, rev60: 0, last14: 0, prev14: 0 }
  const maxSales = Math.max(0, ...items.map((i) => { const s = q(i); return s.q30 + 0.5 * Math.max(0, s.q60 - s.q30) }))
  const line = hitLine(items.map((i) => q(i).q30))
  const products: MProduct[] = items.map((i) => {
    const s = q(i)
    const fresh = i.new_manual || (!i.initial_import && Date.now() - Date.parse(i.created_at) < FRESH_MS)
    const sizesIn = i.sizes.filter((z) => z.in_stock)
    const off = offlineScore({
      q30: s.q30, q60: s.q60, units: i.stock_units ?? 0, sizesIn: sizesIn.length, sizesAll: i.sizes.length, price: i.price,
      cost: cost.get(i.id) ?? null, fresh, season: season.get(i.id) ?? 0.5, outlet: i.outlet,
    }, maxSales, undefined, line, retailRows.length > 0)
    return {
      id: i.id, title: i.title, brand: i.brand?.name ?? null, cat: i.category?.handle ?? null, sub: i.subtype?.name ?? null,
      color: i.color, thumb: i.thumbnail, sizes: sizesIn.map((z) => z.size),
      score: useOffline ? off.score : i.score ?? 0, site_score: i.score ?? 0,
      price: i.price, units: i.stock_units ?? 0, warmth: i.warmth ?? null, model: i.model ?? null, outlet: i.outlet, fresh,
      role: off.role, q30: s.q30, q60: s.q60, weeks: off.weeks,
    }
  })
  return { products, source: useOffline ? "offline" : "site", retail_days: days }
}
