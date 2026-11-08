import { cacheLife, cacheTag } from "next/cache"
import { connection } from "next/server"
import { Suspense } from "react"

import { medusa } from "@/lib/medusa"
import { SITE_NAME } from "@/lib/site"

/**
 * Регион магазина из Medusa. Кэшируется, сбрасывается тегом "regions".
 * Ошибка не перехватывается внутри кэша: иначе в кэш попал бы ответ
 * «недоступна» и держался бы часами, даже когда Medusa уже работает.
 */
async function getCachedRegion() {
  "use cache"
  cacheTag("regions")
  cacheLife("hours")
  const { regions } = await medusa.store.region.list()
  return regions[0] ?? null
}

/**
 * Статус подключения проверяется при каждом открытии страницы (connection()),
 * а не один раз при сборке. Успешный ответ Medusa при этом берётся из кэша.
 */
async function MedusaStatus() {
  await connection()
  let region = null
  try {
    region = await getCachedRegion()
  } catch {
    region = null
  }
  return region
    ? `Medusa подключена: регион «${region.name}», валюта ${region.currency_code.toUpperCase()}`
    : "Medusa недоступна"
}

/** Временная главная: проверка связки витрина ↔ Medusa. Настоящая главная — этап 3. */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-[0.3em]">{SITE_NAME}</h1>
      <p className="text-muted">Сайт в разработке</p>
      <p className="text-sm text-muted">
        <Suspense fallback="Проверка подключения…">
          <MedusaStatus />
        </Suspense>
      </p>
    </main>
  )
}
