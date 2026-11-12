import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { timingSafeEqual } from "crypto"
import { cdekWebhookSecret, findCdekFulfillment, syncCdekFulfillment } from "../../../../lib/delivery/cdek-sync"

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

type Payload = {
  type?: string
  uuid?: string
  date_time?: string
  attributes?: { code?: string; status_code?: string; cdek_number?: string; status_date_time?: string; is_return?: boolean }
}

/**
 * Вебхук СДЭК ORDER_STATUS. Адрес регистрируется скриптом cdek-webhook.ts.
 * Уведомление — только сигнал: статус берётся из API СДЭК.
 * Отвечаем 200 всегда (иначе СДЭК повторяет), ошибки пишем в лог.
 */
export async function POST(req: MedusaRequest<Payload>, res: MedusaResponse) {
  if (!sameSecret(String(req.params.secret ?? ""), cdekWebhookSecret())) {
    res.status(404).end()
    return
  }
  const logger = req.scope.resolve("logger")
  const p = req.body ?? {}
  const code = p.attributes?.code ?? p.attributes?.status_code
  try {
    if (p.type === "ORDER_STATUS" && p.uuid && code && !p.attributes?.is_return) {
      const f = await findCdekFulfillment(req.scope, { uuid: p.uuid })
      // Статусу из уведомления не доверяем: запрашиваем заказ у СДЭК по нашему ключу.
      // Иначе, узнав адрес вебхука, можно было бы прислать «Вручён» и отметить оплату при получении
      if (f) await syncCdekFulfillment(req.scope, f)
    }
  } catch (e) {
    logger.warn(`СДЭК вебхук: ${(e as Error).message}`)
  }
  res.status(200).json({ ok: true })
}
