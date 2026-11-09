import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../../modules/loyalty/service"
import { getLoyaltySettings } from "../../../../../lib/loyalty/engine"
import { dropForecast, normalizePhone } from "../../../../../lib/loyalty/rules"

/** Карточка участника: журнал операций и прогноз понижения. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const phone = normalizePhone(decodeURIComponent(req.params.phone))
  const svc = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const [member] = phone ? await svc.listLoyaltyMembers({ phone }) : []
  if (!member) {
    res.status(404).json({ message: "Участник не найден" })
    return
  }
  const entries = await svc.listLoyaltyEntries({ phone: phone! }, { take: 5000, order: { purchased_at: "DESC" } })
  const f = dropForecast(entries as never, await getLoyaltySettings())
  res.json({ member, entries, forecast: f ? { level: f.level.name, future: f.future.name, need: f.need, until: f.until } : null })
}
