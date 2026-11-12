import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import YandexSplitPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [YandexSplitPaymentProviderService],
})
