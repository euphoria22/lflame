import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BRAND_MODULE } from "../modules/brand"
import BrandModuleService from "../modules/brand/service"

/**
 * Cactus Jack — отдельный бренд, как в поле «Бренд» МоегоСклада. Раньше он был записан
 * другим написанием Travis Scott, и такие товары попадали в Travis Scott.
 * Убираем это написание; при следующей синхронизации бренд Cactus Jack создастся сам.
 * Выполняется один раз при `medusa db:migrate`.
 */
export default async function brandCactusJackSeparate({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const brands: BrandModuleService = container.resolve(BRAND_MODULE)
  const list = await brands.listBrands({ handle: "travis-scott" })
  for (const b of list) {
    const aliases = ((b.aliases as unknown as string[] | null) ?? []).filter((a) => !/cactus\s*jack/i.test(a))
    await brands.updateBrands({ id: b.id, aliases: aliases as unknown as Record<string, unknown> })
    logger.info(`Бренды: у Travis Scott убраны написания Cactus Jack (осталось: ${aliases.length})`)
  }
}
