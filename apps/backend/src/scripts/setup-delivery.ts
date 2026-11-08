import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow, updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Способы доставки (ТЗ, п. 5): самовывоз в Омске, СДЭК (пункт выдачи и курьер), Почта России.
 * Повторный запуск ничего не дублирует.
 *
 *   npx medusa exec ./src/scripts/setup-delivery.ts
 */
export default async function setupDelivery({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_providers.id", "fulfillment_sets.service_zones.id", "fulfillment_sets.service_zones.name"],
  })
  const location = locations[0] as unknown as {
    id: string
    fulfillment_providers?: { id: string }[]
    fulfillment_sets?: { service_zones?: { id: string; name: string }[] }[]
  }
  const zone = location.fulfillment_sets?.[0]?.service_zones?.[0]
  if (!zone) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Нет зоны доставки «Россия»: сначала выполните db:migrate")

  for (const provider of ["cdek_cdek", "pochta_pochta"]) {
    if (!location.fulfillment_providers?.some((p) => p.id === provider)) {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: provider },
      })
      logger.info(`Доставка: провайдер ${provider} подключён к складу`)
    }
  }

  const { data: profiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "type"] })
  const profile = (profiles as { id: string; type: string }[]).find((p) => p.type === "default") ?? profiles[0]
  const { data: existing } = await query.graph({ entity: "shipping_option", fields: ["id", "name", "provider_id", "data"] })
  const rules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
    { attribute: "is_return", value: "false", operator: "eq" as const },
  ]

  // Самовывоз: название и описание с адресом магазина
  const pickup = (existing as { id: string; provider_id: string }[]).find((o) => o.provider_id === "manual_manual")
  if (pickup) {
    await updateShippingOptionsWorkflow(container).run({
      input: [{
        id: pickup.id,
        name: "Самовывоз — Омск, ул. Партизанская, 5а/8",
        type: { label: "Самовывоз", description: "Бесплатно. Ежедневно с 12:00 до 21:00", code: "pickup" },
      }],
    })
  }

  const wanted = [
    { name: "СДЭК — пункт выдачи", provider_id: "cdek_cdek", data: { id: "cdek-pvz", tariff: 136, kind: "pvz" }, code: "cdek-pvz", description: "Доставка до пункта выдачи СДЭК" },
    { name: "СДЭК — курьер", provider_id: "cdek_cdek", data: { id: "cdek-door", tariff: 137, kind: "door" }, code: "cdek-door", description: "Курьер СДЭК до двери" },
    { name: "Почта России", provider_id: "pochta_pochta", data: { id: "pochta-parcel" }, code: "pochta", description: "Посылка до отделения Почты России" },
  ]
  const toCreate = wanted.filter((w) => !(existing as { name: string }[]).some((o) => o.name === w.name))
  if (toCreate.length) {
    await createShippingOptionsWorkflow(container).run({
      input: toCreate.map((w) => ({
        name: w.name,
        price_type: "calculated" as const,
        provider_id: w.provider_id,
        service_zone_id: zone.id,
        shipping_profile_id: profile.id,
        data: w.data,
        type: { label: w.name, description: w.description, code: w.code },
        rules,
      })),
    })
  }
  logger.info(`Доставка: создано способов ${toCreate.length}, всего ${existing.length + toCreate.length}`)
}
