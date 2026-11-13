import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { esc, sendTelegram } from "../notify/telegram"

/**
 * Вход в админку без ограничения по IP (из России не работает Telegram с VPN, а VPN в список доверенных не добавить).
 * Взамен: не больше 10 попыток входа за 15 минут с одного адреса, сообщение в Telegram о каждом входе
 * и о подборе пароля; второй фактор — приложение-аутентификатор (Medusa MFA, профиль сотрудника).
 */
const WINDOW_MS = 15 * 60_000
const LIMIT = 10
const attempts = new Map<string, number[]>()
const warned = new Map<string, number>()

/** Адрес клиента: Caddy ставит X-Forwarded-For сам (подменить снаружи нельзя) — берём последний */
export function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const xff = req.headers["x-forwarded-for"]
  const list = (Array.isArray(xff) ? xff.join(",") : xff ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  return list.at(-1) ?? req.ip ?? "?"
}

/** Учесть попытку; true — лимит превышен */
export function overLimit(ip: string, now = Date.now()): boolean {
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  list.push(now)
  attempts.set(ip, list)
  if (attempts.size > 5000) for (const [k, v] of attempts) if (!v.some((t) => now - t < WINDOW_MS)) attempts.delete(k)
  return list.length > LIMIT
}

export async function adminLoginGuard(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const ip = clientIp(req as never)
  const email = String((req.body as { email?: string } | undefined)?.email ?? "").trim().toLowerCase().slice(0, 100)
  if (overLimit(ip)) {
    // Предупреждаем о подборе не чаще раза в час на адрес
    if (Date.now() - (warned.get(ip) ?? 0) > 3_600_000) {
      warned.set(ip, Date.now())
      void sendTelegram(`🚨 <b>Подбор пароля к админке?</b>\nБольше ${LIMIT} попыток входа за 15 минут с адреса ${esc(ip)}${email ? ` (${esc(email)})` : ""}. Вход с этого адреса временно закрыт.`).catch(() => null)
    }
    res.status(429).json({ message: "Слишком много попыток входа. Попробуйте через 15 минут." })
    return
  }
  res.on("finish", () => {
    if (res.statusCode === 200) {
      void sendTelegram(`🔐 Вход в админку: ${esc(email || "—")}\nАдрес: ${esc(ip)} · ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Omsk" })} (Омск)`).catch(() => null)
    }
  })
  next()
}
