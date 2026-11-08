import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import TbankPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [TbankPaymentProviderService],
})
