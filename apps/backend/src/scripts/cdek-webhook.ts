import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cdekRequest } from "../lib/delivery/cdek-client"
import { cdekWebhookSecret } from "../lib/delivery/cdek-sync"

/**
 * Подписка на статусы заказов СДЭК. Запускать на сервере после подключения боевых ключей:
 *   npx medusa exec ./src/scripts/cdek-webhook.ts
 * MEDUSA_BACKEND_URL должен быть адресом из интернета (https://...).
 */
export default async function cdekWebhook({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const backend = (process.env.MEDUSA_BACKEND_URL || "").replace(/\/+$/, "")
  if (!/^https:\/\//.test(backend)) {
    logger.error("MEDUSA_BACKEND_URL должен начинаться с https:// — СДЭК не достучится до localhost")
    return
  }
  const url = `${backend}/hooks/cdek/${cdekWebhookSecret()}`
  const existing = await cdekRequest<{ uuid: string; url: string; type: string }[]>("/webhooks")
  if (existing.some((w) => w.type === "ORDER_STATUS" && w.url === url)) {
    logger.info("СДЭК: подписка на статусы уже есть")
    return
  }
  await cdekRequest("/webhooks", { method: "POST", body: { url, type: "ORDER_STATUS" } })
  logger.info(`СДЭК: подписка на статусы создана (${backend}/hooks/cdek/…)`)
}
