import { cacheLife, cacheTag } from "next/cache"

import { medusa } from "@/lib/medusa"
import { SITE_NAME } from "@/lib/site"

/** Регион магазина из Medusa. Кэшируется, сбрасывается тегом "regions". */
async function getRegion() {
  "use cache"
  cacheTag("regions")
  cacheLife("hours")
  try {
    const { regions } = await medusa.store.region.list()
    return regions[0] ?? null
  } catch {
    return null
  }
}

/** Временная главная: проверка связки витрина ↔ Medusa. Настоящая главная — этап 3. */
export default async function HomePage() {
  const region = await getRegion()

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-[0.3em]">{SITE_NAME}</h1>
      <p className="text-muted">Сайт в разработке</p>
      <p className="text-sm text-muted">
        {region
          ? `Medusa подключена: регион «${region.name}», валюта ${region.currency_code.toUpperCase()}`
          : "Medusa недоступна"}
      </p>
    </main>
  )
}
