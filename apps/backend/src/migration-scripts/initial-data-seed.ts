import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Базовая настройка магазина LAFLAMME (ТЗ, п. 1.2, 10).
 * Выполняется один раз при первом `medusa db:migrate`.
 *
 * Товаров здесь нет: каталог приходит из МоегоСклада (ТЗ, п. 3).
 * Доставка СДЭК / Почта / Яндекс подключается провайдером ApiShip (ТЗ, п. 5);
 * пока создаётся только самовывоз, чтобы оформление заказа работало сразу.
 */
export default async function initialDataSeed({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )

  // Идемпотентность: в собранном коде скрипт называется .js, а не .ts, и Medusa
  // считает его новым. Если магазин уже есть — ничего не создаём повторно.
  const { data: existing } = await query.graph({ entity: "store", fields: ["id"] })
  if (existing.length) {
    logger.info("LAFLAMME: магазин уже настроен, начальные данные пропущены")
    return
  }

  logger.info("LAFLAMME: канал продаж и ключ витрины...")
  const {
    result: [webSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "Интернет-магазин",
          description: "Сайт LAFLAMME",
        },
      ],
    },
  })

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Витрина LAFLAMME",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  })

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [webSalesChannel.id],
    },
  })

  logger.info("LAFLAMME: магазин и валюта RUB...")
  await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "LAFLAMME",
          supported_currencies: [{ currency_code: "rub", is_default: true }],
          default_sales_channel_id: webSalesChannel.id,
        },
      ],
    },
  })

  logger.info("LAFLAMME: регион Россия...")
  // Цены в МоемСкладе указаны с НДС, поэтому налог включён в цену.
  await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Россия",
          currency_code: "rub",
          countries: ["ru"],
          automatic_taxes: true,
          is_tax_inclusive: true,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })

  await createTaxRegionsWorkflow(container).run({
    input: [{ country_code: "ru", provider_id: "tp_system" }],
  })

  logger.info("LAFLAMME: склад интернет-магазина...")
  const {
    result: [stockLocation],
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: "Склад интернет-магазина",
          address: {
            city: "Москва",
            country_code: "RU",
            address_1: "",
          },
        },
      ],
    },
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [webSalesChannel.id],
    },
  })

  logger.info("LAFLAMME: зона доставки Россия и самовывоз...")
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfile = shippingProfiles[0]

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Доставка по России",
    type: "shipping",
    service_zones: [
      {
        name: "Россия",
        geo_zones: [{ country_code: "ru", type: "country" }],
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Самовывоз из магазина",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Самовывоз",
          description: "Бесплатно, из магазина LAFLAMME",
          code: "pickup",
        },
        prices: [{ currency_code: "rub", amount: 0 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  logger.info("LAFLAMME: базовая настройка завершена.")
}
