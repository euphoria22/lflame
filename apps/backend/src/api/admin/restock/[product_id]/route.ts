import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ACCOUNT_MODULE } from "../../../../modules/account"
import AccountModuleService from "../../../../modules/account/service"

type Row = { variant_id: string; size: string; notified_at: Date | null }

/** Сколько покупателей ждут каждый размер товара (и скольким уже ушло письмо). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["variants.id"], filters: { id: req.params.product_id } })
  const ids = ((data[0] as { variants?: { id: string }[] } | undefined)?.variants ?? []).map((v) => v.id)
  if (!ids.length) {
    res.json({ sizes: [] })
    return
  }
  const svc = req.scope.resolve(ACCOUNT_MODULE) as AccountModuleService
  const rows = (await svc.listRestockRequests({ variant_id: ids }, { take: 5000 })) as unknown as Row[]
  const by = new Map<string, { size: string; waiting: number; notified: number }>()
  for (const r of rows) {
    const s = by.get(r.variant_id) ?? { size: r.size, waiting: 0, notified: 0 }
    if (r.notified_at) s.notified++
    else s.waiting++
    by.set(r.variant_id, s)
  }
  res.json({ sizes: [...by.values()].sort((a, b) => b.waiting - a.waiting) })
}
