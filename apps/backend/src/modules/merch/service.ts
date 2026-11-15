import { MedusaService } from "@medusajs/framework/utils"
import MerchLayout from "./models/layout"
import MerchTask from "./models/task"

class MerchModuleService extends MedusaService({ MerchLayout, MerchTask }) {}

export default MerchModuleService
