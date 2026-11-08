import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { applyCdekStatus, cdekWebhookSecret, findCdekFulfillment } from "../../../../lib/delivery/cdek-sync"

type Payload = {
  type?: string
  uuid?: string
  date_time?: string
  attributes?: { code?: string; status_code?: string; cdek_number?: string; status_date_time?: string; is_return?: boolean }
}

/**
 * Вебхук СДЭК ORDER_STATUS. Адрес регистрируется скриптом cdek-webhook.ts.
 * Отвечаем 200 всегда (иначе СДЭК повторяет), ошибки пишем в лог.
 */
export async function POST(req: MedusaRequest<Payload>, res: MedusaResponse) {
  if (req.params.secret !== cdekWebhookSecret()) {
    res.status(404).end()
    return
  }
  const logger = req.scope.resolve("logger")
  const p = req.body ?? {}
  const code = p.attributes?.code ?? p.attributes?.status_code
  try {
    if (p.type === "ORDER_STATUS" && p.uuid && code && !p.attributes?.is_return) {
      const f = await findCdekFulfillment(req.scope, { uuid: p.uuid })
      if (f) await applyCdekStatus(req.scope, f, { code, at: p.attributes?.status_date_time ?? p.date_time, cdek_number: p.attributes?.cdek_number })
    }
  } catch (e) {
    logger.warn(`СДЭК вебхук: ${(e as Error).message}`)
  }
  res.status(200).json({ ok: true })
}
