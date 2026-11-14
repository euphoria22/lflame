import { Module } from "@medusajs/framework/utils"
import SortModuleService from "./service"

export const SORT_MODULE = "sort"

export default Module(SORT_MODULE, {
  service: SortModuleService,
})
