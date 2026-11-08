import { container } from "@medusajs/framework"
import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"
import type { AuthenticationInput, AuthenticationResponse, AuthIdentityProviderService } from "@medusajs/framework/types"
import { ACCOUNT_MODULE } from "../account"
import AccountModuleService from "../account/service"

/**
 * Вход без пароля по одноразовому коду (ТЗ, п. 6.5).
 * Код запрашивается на /store/account/code, проверяется здесь: POST /auth/customer/otp { email, code }.
 */
class OtpAuthProviderService extends AbstractAuthModuleProvider {
  static identifier = "otp"
  static DISPLAY_NAME = "Код на почту"

  async authenticate(data: AuthenticationInput, identities: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    const body = (data.body ?? {}) as { email?: string; code?: string }
    const email = String(body.email ?? "").trim().toLowerCase()
    if (!email || !body.code) return { success: false, error: "Укажите email и код" }
    const account = container.resolve<AccountModuleService>(ACCOUNT_MODULE)
    if (!(await account.consumeCode(email, String(body.code)))) return { success: false, error: "Неверный или устаревший код" }
    try {
      return { success: true, authIdentity: await identities.retrieve({ entity_id: email }) }
    } catch (e) {
      if ((e as MedusaError).type !== MedusaError.Types.NOT_FOUND) throw e
      return { success: true, authIdentity: await identities.create({ entity_id: email, user_metadata: { email } }) }
    }
  }

  async register(): Promise<AuthenticationResponse> {
    // Отдельной регистрации нет: первый вход по коду создаёт учётную запись
    return { success: false, error: "Войдите по коду" }
  }
}

export default OtpAuthProviderService
