import { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import MoyskladModuleService from "../modules/moysklad/service"

type Webhook = { id: string; url: string; action: string; entityType: string; enabled: boolean }
type WebhookStock = { id: string; url: string; enabled: boolean }

/**
 * Регистрация вебхуков МоегоСклада (ТЗ, п. 3.2, 3.3). Запускается один раз на production:
 *
 *   npx medusa exec ./src/scripts/moysklad-webhooks.ts https://api.laflamme.ru
 *
 * Адрес должен быть публичным и вести на бэкенд Medusa. Повторный запуск ничего не дублирует.
 * Чтобы удалить вебхуки этого сайта: добавьте аргумент remove.
 */
export default async function moyskladWebhooks({ container, args }: ExecArgs) {
  const [baseUrl, action] = args
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  if (!baseUrl?.startsWith("https://")) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Укажите публичный https-адрес бэкенда: npx medusa exec ./src/scripts/moysklad-webhooks.ts https://...")
  }
  if (!ms.options.webhookSecret) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Задайте MOYSKLAD_WEBHOOK_SECRET в .env")
  }
  const url = `${baseUrl.replace(/\/+$/, "")}/hooks/moysklad/${ms.options.webhookSecret}`

  const hooks = await ms.api.listAll<Webhook>("entity/webhook")
  const stockHooks = await ms.api.listAll<WebhookStock>("entity/webhookstock")
  const ours = hooks.filter((h) => h.url === url)
  const oursStock = stockHooks.filter((h) => h.url === url)

  if (action === "remove") {
    for (const h of ours) await ms.api.post("entity/webhook/delete", [{ meta: { href: `${"https://api.moysklad.ru/api/remap/1.2"}/entity/webhook/${h.id}`, type: "webhook" } }])
    for (const h of oursStock) await ms.api.post("entity/webhookstock/delete", [{ meta: { href: `${"https://api.moysklad.ru/api/remap/1.2"}/entity/webhookstock/${h.id}`, type: "webhookstock" } }])
    console.log(`Удалено вебхуков: ${ours.length + oursStock.length}`)
    return
  }

  let created = 0
  for (const entityType of ["product", "variant"]) {
    for (const act of ["CREATE", "UPDATE", "DELETE"]) {
      if (ours.some((h) => h.entityType === entityType && h.action === act)) continue
      await ms.api.post("entity/webhook", { url, action: act, entityType })
      created++
    }
  }
  if (!oursStock.length) {
    await ms.api.post("entity/webhookstock", { url, enabled: true, reportType: "bystore", stockType: "stock" })
    created++
  }
  console.log(`Вебхуки МоегоСклада: создано ${created}, уже было ${ours.length + oursStock.length}. Адрес: ${baseUrl}/hooks/moysklad/***`)
}
