import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { applyPromoAttributes } from "../lib/catalog/promo-attributes"

/**
 * Первый раз проставить всем товарам коллекцию-бренд и теги (пол, цвет, пометки) для условий акций.
 * Дальше их обновляют синхронизация с МС, переключатели «Продажа на сайте» и раздел «Бренды».
 * Выполняется один раз при `medusa db:migrate`.
 */
export default async function promoAttributes({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const n = await applyPromoAttributes(container)
  logger.info(`Акции: коллекции-бренды и теги проставлены у ${n} товаров`)
}
