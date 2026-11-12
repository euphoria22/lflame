import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Включает способы оплаты в регионе «Россия»: при получении, Т-Касса и Яндекс Сплит.
 * Запуск: npx medusa exec ./src/scripts/setup-payments.ts (повторный запуск безопасен).
 */
export default async function setupPayments({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "name", "payment_providers.id"] })
  for (const r of regions as { id: string; name: string; payment_providers?: { id: string }[] }[]) {
    const ids = new Set((r.payment_providers ?? []).map((p) => p.id))
    ids.add("pp_system_default")
    ids.add("pp_tbank_tbank")
    ids.add("pp_yandex_split")
    await updateRegionsWorkflow(container).run({ input: { selector: { id: r.id }, update: { payment_providers: [...ids] } } })
    logger.info(`Регион «${r.name}»: оплата ${[...ids].join(", ")}`)
  }
}
