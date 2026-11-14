import { MedusaService } from "@medusajs/framework/utils"
import SortCardCost from "./models/card-data"
import SortConfigVersion from "./models/config-version"
import SortListingEvent from "./models/listing-event"
import SortManualRule from "./models/manual-rule"
import SortProductScore from "./models/product-score"

class SortModuleService extends MedusaService({ SortProductScore, SortListingEvent, SortConfigVersion, SortManualRule, SortCardCost }) {}

export default SortModuleService
