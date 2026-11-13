/**
 * Уведомления магазину в Telegram (ТЗ, п. 6.6): бот @BotFather, TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env.
 * Без них сообщения печатаются в журнал сервера.
 */
export async function sendTelegram(text: string, log: { info: (m: string) => void; warn: (m: string) => void } = console): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_CHAT_ID
  if (!token || !chat) {
    log.info(`[Telegram не настроен] ${text}`)
    return
  }
  // TELEGRAM_API_URL — посредник, если api.telegram.org недоступен с сервера (в РФ бывает заблокирован)
  // Адрес можно записать и без https:// — допишем сами
  const raw = (process.env.TELEGRAM_API_URL || "https://api.telegram.org").trim().replace(/\/+$/, "")
  const api = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  // Токен не должен попадать в журнал вместе с текстом ошибки
  const hide = (m: string) => m.split(token).join("***")
  try {
    const res = await fetch(`${api}/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Секрет посредника (infra/telegram-relay): без него посредник не пропустит сообщение
        ...(process.env.TELEGRAM_RELAY_SECRET ? { "X-Relay-Secret": process.env.TELEGRAM_RELAY_SECRET } : {}),
      },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
      // Недоступный Telegram не должен задерживать заказы и задачи
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) log.warn(hide(`Telegram: ${res.status} ${await res.text().catch(() => "")}`))
  } catch (e) {
    log.warn(hide(`Telegram недоступен: ${(e as Error).message}`))
  }
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)

/** Адрес Telegram API (или посредника) и заголовки — общие для уведомлений и постов в канал */
function apiBase() {
  const raw = (process.env.TELEGRAM_API_URL || "https://api.telegram.org").trim().replace(/\/+$/, "")
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

export class TelegramError extends Error {
  constructor(message: string, readonly code: number, readonly retryAfter?: number) { super(message) }
}

/**
 * Вызов метода Bot API (sendMediaGroup, editMessageCaption…). Ошибка — TelegramError с понятным текстом,
 * токен в текст не попадает. При «слишком часто» Telegram сообщает, через сколько секунд повторить.
 */
export async function telegramApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new TelegramError("Telegram не настроен: нет TELEGRAM_BOT_TOKEN", 0)
  const hide = (m: string) => m.split(token).join("***")
  let res: Response
  try {
    res = await fetch(`${apiBase()}/bot${token}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.TELEGRAM_RELAY_SECRET ? { "X-Relay-Secret": process.env.TELEGRAM_RELAY_SECRET } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    throw new TelegramError(hide(`Telegram недоступен: ${(e as Error).message}`), 0)
  }
  const d = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } } | null
  if (!res.ok || !d?.ok) {
    // Посредник не пропустил метод — значит, его код в Cloudflare старый
    if (res.status === 404 && !d) throw new TelegramError("Посредник Telegram не пропускает этот запрос — обновите код Worker в Cloudflare (infra/telegram-relay/worker.js)", 404)
    if (res.status === 403 && !d) throw new TelegramError("Посредник Telegram отклонил запрос: проверьте TELEGRAM_RELAY_SECRET", 403)
    throw new TelegramError(hide(`Telegram: ${d?.description ?? res.status}`), d?.error_code ?? res.status, d?.parameters?.retry_after)
  }
  return d.result as T
}

