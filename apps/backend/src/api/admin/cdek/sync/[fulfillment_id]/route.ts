import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { findCdekFulfillment, syncCdekFulfillment } from "../../../../../lib/delivery/cdek-sync"

/** Кнопка «Обновить статус» в блоке «СДЭК». */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const f = await findCdekFulfillment(req.scope, { id: req.params.fulfillment_id })
  if (!f) {
    res.status(404).json({ message: "Отправка не найдена" })
    return
  }
  try {
    await syncCdekFulfillment(req.scope, f)
    res.json({ ok: true })
  } catch (e) {
    res.status(502).json({ message: (e as Error).message })
  }
}
