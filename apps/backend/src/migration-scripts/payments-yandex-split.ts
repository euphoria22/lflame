import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Включает оплату Яндекс Сплитом (pp_yandex_split) в регионах магазина, не трогая остальные способы.
 * На витрине Сплит появляется только при заданном YANDEX_PAY_API_KEY. Выполняется один раз при `medusa db:migrate`.
 */
export default async function paymentsYandexSplit({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "name", "payment_providers.id"] })
  for (const r of regions as { id: string; name: string; payment_providers?: { id: string }[] }[]) {
    const ids = new Set((r.payment_providers ?? []).map((p) => p.id))
    if (ids.has("pp_yandex_split")) continue
    ids.add("pp_yandex_split")
    await updateRegionsWorkflow(container).run({ input: { selector: { id: r.id }, update: { payment_providers: [...ids] } } })
    logger.info(`Регион «${r.name}»: добавлена оплата Яндекс Сплитом`)
  }
}
