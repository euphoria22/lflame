import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import OtpAuthProviderService from "./service"

export default ModuleProvider(Modules.AUTH, {
  services: [OtpAuthProviderService],
})
