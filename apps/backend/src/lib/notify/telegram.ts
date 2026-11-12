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
