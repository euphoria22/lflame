import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PochtaFulfillmentProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [PochtaFulfillmentProviderService],
})
