import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ListingEvent, recordEvents } from "../../../../lib/sort/engine"

/** События листингов с сайта: показ, клик, корзина, визит. Пачкой, агрегируются по дням */
export async function POST(req: MedusaRequest<{ events?: ListingEvent[] }>, res: MedusaResponse) {
  const events = Array.isArray(req.body?.events) ? req.body.events : []
  res.json({ ok: true, saved: await recordEvents(req.scope, events) })
}
