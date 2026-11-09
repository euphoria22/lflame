import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { sendMail } from "../notify/mailer"
import { newsletterWelcomeMail, site } from "../notify/templates"
import { getShopSettings } from "../settings/shop-settings"
import { ACCOUNT_MODULE } from "../../modules/account"
import AccountModuleService from "../../modules/account/service"

type Sub = { id: string; email: string; promo_code: string | null; unsubscribed_at: Date | null; created_at: Date }

const svc = (c: MedusaContainer) => c.resolve(ACCOUNT_MODULE) as AccountModuleService
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Подпись ссылки «отписаться»: без неё нельзя отписать чужой адрес. */
export function unsubscribeToken(email: string): string {
  return createHmac("sha256", `${process.env.COOKIE_SECRET ?? ""}:newsletter`).update(email.toLowerCase()).digest("hex").slice(0, 32)
}

export function unsubscribeUrl(email: string): string {
  return `${site()}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`
}

/** Одноразовый промокод: HELLO-XXXXXX, скидка на заказ, лимит 1 использование. */
async function createWelcomePromo(c: MedusaContainer, pct: number): Promise<string> {
  const promotions = c.resolve(Modules.PROMOTION)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `HELLO-${[...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join("")}`
    try {
      await promotions.createPromotions({
        code,
        type: "standard",
        status: "active",
        is_automatic: false,
        limit: 1,
        application_method: { type: "percentage", target_type: "order", value: pct, allocation: "across", currency_code: "rub" },
      } as never)
      return code
    } catch (e) {
      if (attempt === 4) throw e
    }
  }
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Не получилось создать промокод")
}

/**
 * Подписка: новый адрес получает одноразовый промокод письмом (если скидка включена в админке).
 * Повторная подписка того же адреса нового кода не даёт; отписавшийся может подписаться снова (без нового кода).
 */
export async function subscribeNewsletter(c: MedusaContainer, rawEmail: string, source = "footer"): Promise<{ status: "subscribed" | "already" | "resubscribed"; promo: boolean }> {
  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 200) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Проверьте email")
  const settings = (await getShopSettings()).newsletter
  if (!settings.enabled) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Подписка сейчас недоступна")
  const logger = c.resolve(ContainerRegistrationKeys.LOGGER)

  const [existing] = (await svc(c).listNewsletterSubscribers({ email }, { take: 1 })) as unknown as Sub[]
  if (existing && !existing.unsubscribed_at) return { status: "already", promo: false }
  if (existing) {
    await svc(c).updateNewsletterSubscribers({ id: existing.id, unsubscribed_at: null })
    await sendMail(newsletterWelcomeMail(email, { code: null, pct: 0, unsubscribeUrl: unsubscribeUrl(email) }), logger).catch(() => null)
    return { status: "resubscribed", promo: false }
  }

  const code = settings.discount_pct > 0 ? await createWelcomePromo(c, settings.discount_pct) : null
  await svc(c).createNewsletterSubscribers({ email, promo_code: code, source })
  await sendMail(newsletterWelcomeMail(email, { code, pct: settings.discount_pct, unsubscribeUrl: unsubscribeUrl(email) }), logger)
    .catch((e) => logger.warn(`Подписка: письмо ${email} не отправлено — ${(e as Error).message}`))
  return { status: "subscribed", promo: !!code }
}

export async function unsubscribeNewsletter(c: MedusaContainer, rawEmail: string, token: string): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase()
  const expected = Buffer.from(unsubscribeToken(email))
  const got = Buffer.from(String(token))
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return false
  const [sub] = (await svc(c).listNewsletterSubscribers({ email }, { take: 1 })) as unknown as Sub[]
  if (sub && !sub.unsubscribed_at) await svc(c).updateNewsletterSubscribers({ id: sub.id, unsubscribed_at: new Date() })
  return true
}

export async function listSubscribers(c: MedusaContainer): Promise<Sub[]> {
  return (await svc(c).listNewsletterSubscribers({}, { take: 100000, order: { created_at: "DESC" } })) as unknown as Sub[]
}
