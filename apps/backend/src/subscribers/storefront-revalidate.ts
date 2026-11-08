import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Сброс кэша витрины при изменении каталога (ТЗ, п. 7.1: обновление за ≤ 1 минуту).
 * Синхронизация с МС порождает тысячи событий подряд, поэтому запросы к витрине
 * объединяются: один сброс не чаще чем раз в 10 секунд.
 */
let timer: NodeJS.Timeout | null = null
const DEBOUNCE_MS = 10_000

export default async function storefrontRevalidate({ container }: SubscriberArgs<Record<string, unknown>>) {
  const url = process.env.STOREFRONT_URL
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET
  if (!url || !secret || timer) return

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  timer = setTimeout(async () => {
    timer = null
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
        body: JSON.stringify({ tags: ["catalog"] }),
      })
      if (!res.ok) logger.warn(`Витрина: сброс кэша вернул ${res.status}`)
    } catch (e) {
      logger.warn(`Витрина: не удалось сбросить кэш: ${(e as Error).message}`)
    }
  }, DEBOUNCE_MS)
}

export const config: SubscriberConfig = {
  event: [
    "product.created", "product.updated", "product.deleted",
    "product-variant.created", "product-variant.updated", "product-variant.deleted",
    "product-category.created", "product-category.updated", "product-category.deleted",
    "inventory-level.created", "inventory-level.updated",
    "brand.created", "brand.updated",
  ],
}
