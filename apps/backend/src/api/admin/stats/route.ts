import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { orderStats } from "../../../lib/stats/order-stats"

/** Начало дня по Москве (UTC+3, без перехода на летнее время). */
const mskStart = (d: string) => new Date(`${d}T00:00:00+03:00`)
const DAY = 86400000

/** Статистика заказов за период: ?from=ГГГГ-ММ-ДД&to=ГГГГ-ММ-ДД (обе даты включительно, по Москве). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const re = /^\d{4}-\d{2}-\d{2}$/
  const q = req.query as { from?: string; to?: string }
  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10)
  const toDay = q.to && re.test(q.to) ? q.to : today
  const fromDay = q.from && re.test(q.from) ? q.from : new Date(mskStart(toDay).getTime() - 29 * DAY + 3 * 3600000).toISOString().slice(0, 10)
  const from = mskStart(fromDay)
  const to = new Date(mskStart(toDay).getTime() + DAY)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    res.status(400).json({ message: "Неверный период" })
    return
  }
  if (to.getTime() - from.getTime() > 400 * DAY) {
    res.status(400).json({ message: "Период — не больше 400 дней" })
    return
  }
  res.json(await orderStats(req.scope, from, to))
}
