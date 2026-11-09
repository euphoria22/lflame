/** Сброс кэша витрины после изменения контента (тот же секрет, что у бэкенда). */
export async function revalidateStorefront(tags: string[]): Promise<void> {
  const url = process.env.STOREFRONT_URL
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET
  if (!url || !secret) return
  try {
    await fetch(`${url.replace(/\/+$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ tags }),
    })
  } catch {
    // витрина недоступна — обновится по времени жизни кэша
  }
}
