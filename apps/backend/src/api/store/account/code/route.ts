import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ACCOUNT_MODULE } from "../../../../modules/account"
import AccountModuleService from "../../../../modules/account/service"
import { sendMail } from "../../../../lib/notify/mailer"
import { loginCodeMail } from "../../../../lib/notify/templates"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Запрос кода входа на email (ТЗ, п. 6.5). Ответ одинаковый для любых адресов. */
export async function POST(req: MedusaRequest<{ email?: string }>, res: MedusaResponse) {
  const email = String(req.body?.email ?? "").trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 200) {
    res.status(400).json({ message: "Проверьте email" })
    return
  }
  const account = req.scope.resolve<AccountModuleService>(ACCOUNT_MODULE)
  const logger = req.scope.resolve("logger")
  try {
    const code = await account.issueCode(email)
    await sendMail(loginCodeMail(email, code), logger)
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof MedusaError && e.type === MedusaError.Types.NOT_ALLOWED) {
      res.status(429).json({ message: e.message })
      return
    }
    logger.error(`Код входа для ${email} не отправлен: ${(e as Error).message}`)
    res.status(502).json({ message: "Не удалось отправить письмо. Попробуйте позже." })
  }
}
