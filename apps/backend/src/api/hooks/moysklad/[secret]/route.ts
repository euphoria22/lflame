import { timingSafeEqual } from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { runMoyskladSync } from "../../../../lib/moysklad/run"
import { idFromHref } from "../../../../lib/moysklad/types"
import { MOYSKLAD_MODULE } from "../../../../modules/moysklad"
import MoyskladModuleService from "../../../../modules/moysklad/service"

export const AUTHENTICATE = false

type WebhookBody = {
  events?: { meta?: { type?: string; href?: string }; action?: string }[]
  /** вебхук на изменение остатков (webhookstock) */
  reportUrl?: string
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Приём вебхуков МоегоСклада (ТЗ, п. 3.2, 3.3, 8.3).
 * МС не подписывает вебхуки, поэтому адрес содержит секрет, а данным из тела
 * не доверяем: по событию просто перечитываем изменённые товары через API.
 * Отвечаем сразу, синхронизация идёт в фоне.
 */
export async function POST(req: MedusaRequest<WebhookBody>, res: MedusaResponse) {
  const ms: MoyskladModuleService = req.scope.resolve(MOYSKLAD_MODULE)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const secret = (req.params as { secret?: string }).secret ?? ""

  if (!ms.options.webhookSecret || !sameSecret(secret, ms.options.webhookSecret)) {
    res.sendStatus(404)
    return
  }

  const body = req.body ?? {}
  res.sendStatus(200)

  const run = (p: Promise<unknown>) =>
    p.catch((e) => logger.error(`МойСклад: обработка вебхука не удалась: ${(e as Error).message}`))

  if (body.reportUrl) {
    run(runMoyskladSync(req.scope, "stock", "webhook"))
    return
  }

  const productIds = new Set<string>()
  let variantChanged = false
  for (const e of body.events ?? []) {
    if (e.meta?.type === "product") {
      const id = idFromHref(e.meta.href)
      if (id) productIds.add(id)
    } else if (e.meta?.type === "variant") {
      variantChanged = true
    }
  }
  if (variantChanged || !productIds.size) {
    // Модификация не содержит id товара в событии: берём все изменения с прошлой синхронизации
    run(runMoyskladSync(req.scope, "catalog", "webhook", { mode: "incremental" }))
  } else {
    run(runMoyskladSync(req.scope, "catalog", "webhook", { mode: "products", productIds: [...productIds] }))
  }
}
