import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyEntry from "./models/entry"
import LoyaltyMember from "./models/member"

class LoyaltyModuleService extends MedusaService({ LoyaltyEntry, LoyaltyMember }) {}

export default LoyaltyModuleService
