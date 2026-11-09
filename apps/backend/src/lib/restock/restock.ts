import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { variantStock } from "../catalog/store-catalog"
import { sendMail } from "../notify/mailer"
import { restockMail, site } from "../notify/templates"
import { ACCOUNT_MODULE } from "../../modules/account"
import AccountModuleService from "../../modules/account/service"

type Request = { id: string; email: string; variant_id: string; product_handle: string; product_title: string; size: string; notified_at: Date | null }

const svc = (c: MedusaContainer) => c.resolve(ACCOUNT_MODULE) as AccountModuleService

/** Ждущих подписок на один адрес — не больше (защита от спама формой). */
const MAX_PER_EMAIL = 30

/** Подписка на закончившийся размер. Повторная подписка на тот же размер не создаёт дубль. */
export async function subscribeRestock(c: MedusaContainer, input: { email: string; variant_id: string }): Promise<{ already: boolean }> {
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Проверьте email")

  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "variant",
    fields: ["id", "title", "options.value", "product.handle", "product.title", "product.status"],
    filters: { id: input.variant_id },
  })
  const v = data[0] as unknown as { id: string; title: string; options?: { value: string }[]; product?: { handle: string; title: string; status: string } } | undefined
  if (!v?.product || v.product.status !== "published") throw new MedusaError(MedusaError.Types.NOT_FOUND, "Товар не найден")

  const pending = (await svc(c).listRestockRequests({ email, notified_at: null }, { take: 200 })) as unknown as Request[]
  if (pending.some((r) => r.variant_id === v.id)) return { already: true }
  if (pending.length >= MAX_PER_EMAIL) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Слишком много подписок на этот адрес")

  await svc(c).createRestockRequests({
    email, variant_id: v.id, product_handle: v.product.handle, product_title: v.product.title, size: v.options?.[0]?.value || v.title,
  })
  return { already: false }
}

/** Проверка подписок: размер появился в наличии — письмо и отметка. Запускается после сверки остатков. */
export async function notifyRestocked(c: MedusaContainer): Promise<number> {
  const logger = c.resolve(ContainerRegistrationKeys.LOGGER)
  const pending = (await svc(c).listRestockRequests({ notified_at: null }, { take: 5000 })) as unknown as Request[]
  if (!pending.length) return 0
  const stock = await variantStock(c, [...new Set(pending.map((r) => r.variant_id))])
  let sent = 0
  for (const r of pending) {
    if ((stock.get(r.variant_id) ?? 0) <= 0) continue
    try {
      await sendMail(restockMail(r.email, { title: r.product_title, size: r.size, url: `${site()}/product/${r.product_handle}` }), logger)
      await svc(c).updateRestockRequests({ id: r.id, notified_at: new Date() })
      sent++
    } catch (e) {
      logger.warn(`Сообщить о поступлении: письмо ${r.email} не отправлено — ${(e as Error).message}`)
    }
  }
  if (sent) logger.info(`Сообщить о поступлении: отправлено писем — ${sent}`)
  return sent
}
