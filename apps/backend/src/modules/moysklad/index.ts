import { Module } from "@medusajs/framework/utils"
import MoyskladModuleService from "./service"

export const MOYSKLAD_MODULE = "moysklad"

export default Module(MOYSKLAD_MODULE, {
  service: MoyskladModuleService,
})
