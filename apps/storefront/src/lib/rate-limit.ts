import "server-only"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/**
 * Ограничение частоты запросов с одного IP для действий, которые шлют письма или перебирают коды:
 * код входа, вход, подписка, «Сообщить о поступлении», промокод. Без него сайт можно заставить
 * рассылать письма на чужие адреса — почту магазина начнут считать спамом.
 * Счётчики в памяти витрины (она одна), окно скользящее.
 */
const hits = new Map<string, number[]>()
let lastSweep = 0

/** IP покупателя: Caddy перед сайтом сам выставляет X-Forwarded-For (заголовки от клиента не принимает). */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
}

/** null — можно; иначе готовый ответ 429. */
export function rateLimit(req: NextRequest, action: string, limit: number, windowSec: number): NextResponse | null {
  const now = Date.now()
  const key = `${action}:${clientIp(req)}`
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowSec * 1000)
  if (recent.length >= limit) {
    hits.set(key, recent)
    const retry = Math.ceil((windowSec * 1000 - (now - recent[0])) / 1000)
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте немного позже." }, { status: 429, headers: { "Retry-After": String(retry) } })
  }
  recent.push(now)
  hits.set(key, recent)
  // Раз в 10 минут чистим старые записи, чтобы память не росла
  if (now - lastSweep > 600_000) {
    lastSweep = now
    for (const [k, v] of hits) if (!v.some((t) => now - t < 86_400_000)) hits.delete(k)
  }
  return null
}
