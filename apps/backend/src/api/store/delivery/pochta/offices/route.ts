import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cdekCityCenter } from "../../../../../lib/delivery/cdek-client"
import { pochtaOfficesEnabled, pochtaOfficesNear } from "../../../../../lib/delivery/pochta-offices"

/** Отделения Почты в городе (по коду города СДЭК). available=false — ключей «Отправки» нет. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!pochtaOfficesEnabled()) {
    res.json({ available: false, offices: [] })
    return
  }
  const code = Number((req.query as { city_code?: string }).city_code)
  try {
    const center = code ? await cdekCityCenter(code) : null
    if (!center) {
      res.json({ available: true, offices: [] })
      return
    }
    res.json({ available: true, center, offices: await pochtaOfficesNear(center.lat, center.lon) })
  } catch (e) {
    req.scope.resolve("logger").warn(`Почта: отделения недоступны: ${(e as Error).message}`)
    res.status(502).json({ available: true, offices: [], message: "Не удалось загрузить отделения" })
  }
}
