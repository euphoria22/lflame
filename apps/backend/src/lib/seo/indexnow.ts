import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createHash } from "crypto"

/**
 * IndexNow: сообщаем Яндексу о новых и изменённых товарах — в поиск они попадают за часы, а не недели.
 * Работает только при включённой индексации (INDEXING=on): тестовый адрес в Яндекс не отправляется.
 * Ключ — из секрета витрины (тот же расчёт в витрине, apps/storefront/src/lib/indexnow.ts).
 */
export function indexNowKey(): string | null {
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET
  return secret ? createHash("sha256").update(`indexnow:${secret}`).digest("hex").slice(0, 32) : null
}

export function indexNowEnabled(): boolean {
  return process.env.INDEXING === "on" && Boolean(process.env.STOREFRONT_URL) && Boolean(indexNowKey())
}

/** Отправить адреса (до 10 000 за раз). */
export async function submitUrls(urls: string[], log: { info: (m: string) => void; warn: (m: string) => void }): Promise<void> {
  const key = indexNowKey()
  const site = (process.env.STOREFRONT_URL || "").replace(/\/+$/, "")
  if (!urls.length || !key || !site) return
  const host = new URL(site).host
  for (let i = 0; i < urls.length; i += 10000) {
    const urlList = urls.slice(i, i + 10000)
    try {
      const res = await fetch("https://yandex.com/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key, keyLocation: `${site}/indexnow-key.txt`, urlList }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.ok || res.status === 202) log.info(`IndexNow: отправлено в Яндекс адресов: ${urlList.length}`)
      else log.warn(`IndexNow: Яндекс ответил ${res.status} ${await res.text().catch(() => "")}`)
    } catch (e) {
      log.warn(`IndexNow: не отправлено (${(e as Error).message})`)
    }
  }
}

/** Товары, изменённые с момента since: их адреса на сайте. */
export async function changedProductUrls(container: MedusaContainer, since: Date): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const site = (process.env.STOREFRONT_URL || "").replace(/\/+$/, "")
  const { data } = await query.graph({
    entity: "product",
    fields: ["handle", "status", "metadata"],
    filters: { updated_at: { $gte: since } },
    pagination: { take: 10000 },
  })
  // Опубликованные и снятые с продажи (у них 301 — Яндексу тоже полезно узнать)
  return (data as { handle: string; status: string; metadata?: Record<string, unknown> | null }[])
    .filter((p) => p.status === "published" || p.metadata?.discontinued)
    .map((p) => `${site}/product/${p.handle}`)
}
