import { model } from "@medusajs/framework/utils"

/** Настройки сортировки (sort_config): каждая правка — новая версия с автором; действует последняя */
const SortConfigVersion = model.define("sort_config_version", {
  id: model.id({ prefix: "scv" }).primaryKey(),
  version: model.number().index(),
  config: model.json(),
  author: model.text().nullable(),
  note: model.text().nullable(),
})

export default SortConfigVersion
