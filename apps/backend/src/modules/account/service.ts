import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import LoginCode from "./models/login-code"
import NewsletterSubscriber from "./models/newsletter-subscriber"
import RestockRequest from "./models/restock-request"

const TTL_MIN = 10
const RESEND_SEC = 60
const MAX_ATTEMPTS = 5
const MAX_PER_HOUR = 6

const hash = (target: string, code: string) =>
  createHash("sha256").update(`${target}:${code}:${process.env.COOKIE_SECRET ?? ""}`).digest("hex")

type Row = { id: string; target: string; code_hash: string; expires_at: Date; attempts: number; used_at: Date | null; created_at: Date }

/**
 * Коды входа: 6 цифр, живут 10 минут, повторная отправка не чаще раза в минуту,
 * не больше 6 кодов в час на адрес, 5 попыток ввода на код.
 */
class AccountModuleService extends MedusaService({ LoginCode, NewsletterSubscriber, RestockRequest }) {
  async issueCode(target: string): Promise<string> {
    const t = target.trim().toLowerCase()
    const since = new Date(Date.now() - 3600_000)
    const recent = (await this.listLoginCodes({ target: t, created_at: { $gte: since } }, { order: { created_at: "DESC" } })) as unknown as Row[]
    if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_SEC * 1000) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Код уже отправлен. Повторно — через минуту.")
    }
    if (recent.length >= MAX_PER_HOUR) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Слишком много попыток. Попробуйте через час.")
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
    await this.createLoginCodes({ target: t, code_hash: hash(t, code), expires_at: new Date(Date.now() + TTL_MIN * 60_000) })
    return code
  }

  /** true — код верный (и больше не действует). */
  async consumeCode(target: string, code: string): Promise<boolean> {
    const t = target.trim().toLowerCase()
    const [row] = (await this.listLoginCodes({ target: t, used_at: null }, { order: { created_at: "DESC" }, take: 1 })) as unknown as Row[]
    if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_ATTEMPTS) return false
    const a = Buffer.from(row.code_hash, "hex")
    const b = Buffer.from(hash(t, String(code).replace(/\D/g, "")), "hex")
    const ok = a.length === b.length && timingSafeEqual(a, b)
    await this.updateLoginCodes({ id: row.id, attempts: row.attempts + 1, ...(ok ? { used_at: new Date() } : {}) })
    return ok
  }
}

export default AccountModuleService
