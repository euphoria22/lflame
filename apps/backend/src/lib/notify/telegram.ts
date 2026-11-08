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
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
  })
  if (!res.ok) log.warn(`Telegram: ${res.status} ${await res.text().catch(() => "")}`)
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
