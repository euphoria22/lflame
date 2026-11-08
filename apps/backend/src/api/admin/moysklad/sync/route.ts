import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { runMoyskladSync } from "../../../../lib/moysklad/run"
import { MoyskladSyncBody } from "../validators"

/**
 * Кнопки «Синхронизировать сейчас» (ТЗ, п. 3.6). Синхронизация идёт в фоне,
 * результат появляется в журнале.
 */
export async function POST(req: AuthenticatedMedusaRequest<MoyskladSyncBody>, res: MedusaResponse) {
  const { kind, mode } = req.validatedBody
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  runMoyskladSync(req.scope, kind, "manual", { mode: mode ?? "incremental" }).catch((e) =>
    logger.error(`МойСклад: ручной запуск не удался: ${(e as Error).message}`)
  )
  res.status(202).json({ started: true, kind, mode: mode ?? "incremental" })
}
