import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { refreshPosts } from "../lib/telegram/channel"

/** Посты в Telegram и ВКонтакте: обновить цену и размеры в подписи — через 7 минут после каждой сверки остатков с МС. */
export default async function telegramPostsJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const n = await refreshPosts(container, logger)
  if (n) logger.info(`Соцсети: обновлено подписей постов: ${n}`)
}

export const config = {
  name: "telegram-posts",
  schedule: "7-59/10 * * * *",
}
