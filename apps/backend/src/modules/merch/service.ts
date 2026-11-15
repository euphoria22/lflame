import { MedusaService } from "@medusajs/framework/utils"
import MerchLayout from "./models/layout"
import MerchSale from "./models/sale"
import MerchTask from "./models/task"

class MerchModuleService extends MedusaService({ MerchLayout, MerchTask, MerchSale }) {}

export default MerchModuleService
