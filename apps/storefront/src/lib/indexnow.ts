import "server-only"
import { createHash } from "crypto"

/**
 * Ключ IndexNow (Яндекс): выводится из REVALIDATE_SECRET — тот же расчёт в Medusa (lib/seo/indexnow.ts),
 * поэтому отдельной настройки на сервере не нужно. Сам секрет по ключу не восстановить.
 */
export function indexNowKey(): string | null {
  const secret = process.env.REVALIDATE_SECRET
  return secret ? createHash("sha256").update(`indexnow:${secret}`).digest("hex").slice(0, 32) : null
}
