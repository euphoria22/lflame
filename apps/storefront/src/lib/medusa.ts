import Medusa from "@medusajs/js-sdk"

/**
 * Клиент Medusa Store API. Используется только на сервере (React Server Components,
 * route handlers): браузер не ходит в бэкенд напрямую за каталогом (ТЗ, п. 7.1).
 */
export const medusa = new Medusa({
  baseUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  debug: false,
})
