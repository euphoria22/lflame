import { MedusaService } from "@medusajs/framework/utils"
import { MoyskladClient } from "./client"
import MoyskladSyncRun from "./models/sync-run"

export type MoyskladModuleOptions = {
  /** Токен технического пользователя МС. Только из переменных окружения (ТЗ, п. 8.3). */
  token?: string
  baseUrl?: string
  /** Склад интернет-магазина в МС (ТЗ, п. 3.3) */
  storeName?: string
  salePriceName?: string
  oldPriceName?: string
  /** Секрет в адресе вебхука (ТЗ, п. 8.3) */
  webhookSecret?: string
  /** Выключатель фоновой синхронизации по расписанию */
  scheduleEnabled?: boolean
}

class MoyskladModuleService extends MedusaService({
  MoyskladSyncRun,
}) {
  readonly api: MoyskladClient
  readonly options: Required<Omit<MoyskladModuleOptions, "token" | "baseUrl" | "webhookSecret">> & {
    webhookSecret: string
  }

  constructor(container: Record<string, unknown>, options: MoyskladModuleOptions = {}) {
    super(...arguments)
    this.api = new MoyskladClient({ token: options.token ?? "", baseUrl: options.baseUrl })
    this.options = {
      storeName: options.storeName ?? "Основной склад (Партизанская 5а/8)",
      salePriceName: options.salePriceName ?? "Цена продажи",
      oldPriceName: options.oldPriceName ?? "Старая цена",
      webhookSecret: options.webhookSecret ?? "",
      scheduleEnabled: options.scheduleEnabled ?? false,
    }
  }
}

export default MoyskladModuleService
