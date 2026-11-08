import { Module } from "@medusajs/framework/utils"
import AccountModuleService from "./service"

export const ACCOUNT_MODULE = "account"

export default Module(ACCOUNT_MODULE, {
  service: AccountModuleService,
})
