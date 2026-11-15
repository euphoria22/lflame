import { telegramApi } from "../notify/telegram"
import { BotChat, HELP_TEXT, loadBot, loadShifts, omskNow, patchBot, reminderText, saveShifts, scheduleText, todayText } from "./shifts"

/**
 * Бот графика смен: напоминание утром в рабочий чат и ответы на команды.
 * Сообщения боту забираем сами (getUpdates, «длинный опрос»), без вебхука: сервер в РФ,
 * до Telegram идём через посредника (infra/telegram-relay). Задача запускается раз в минуту
 * и слушает чат ~50 секунд — ответ на команду приходит почти сразу.
 */

type Log = { info: (m: string) => void; warn: (m: string) => void }

type Chat = { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string }
type Update = {
  update_id: number
  message?: { chat: Chat; text?: string; migrate_to_chat_id?: number }
  my_chat_member?: { chat: Chat; new_chat_member?: { status?: string } }
}

const LISTEN_MS = 48_000

const chatTitle = (c: Chat) => c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || (c.username ? `@${c.username}` : String(c.id))

async function send(chatId: string, text: string) {
  await telegramApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
}

/** Напоминание за сегодня, если подошло время и ещё не отправлено (не позже чем через 3 часа после времени) */
async function remindIfDue(log: Log) {
  const s = await loadShifts()
  if (!s.remind_enabled || !s.chat_id) return
  const now = omskNow()
  if (now.time < s.remind_at) return
  const [h, m] = s.remind_at.split(":").map(Number)
  const [nh, nm] = now.time.split(":").map(Number)
  if (nh * 60 + nm - (h * 60 + m) > 180) return
  const bot = await loadBot()
  if (bot.last_sent === now.date) return
  // Сначала отмечаем, потом отправляем: лучше пропустить одно напоминание, чем прислать его дважды
  await patchBot({ last_sent: now.date })
  try {
    await send(s.chat_id, reminderText(s, now.date))
  } catch (e) {
    log.warn(`Смены: напоминание не отправлено: ${(e as Error).message}`)
  }
}

/** Ответ на команду; null — команда не наша */
async function answer(text: string): Promise<string | null> {
  const m = /^\/([a-zа-яё_]+)(?:@\w+)?\s*(.*)$/i.exec(text.trim())
  if (!m) return null
  const cmd = m[1].toLowerCase()
  const arg = m[2].trim().toLowerCase()
  const s = await loadShifts()
  if (["smena", "smeny", "today", "смена", "смены"].includes(cmd)) return todayText(s)
  if (["grafik", "graphik", "schedule", "график"].includes(cmd)) {
    if (/^(next|sled|след)/.test(arg)) return scheduleText(s, "next_month")
    if (/^(mes|month|vse|ves|мес|вес|все)/.test(arg)) return scheduleText(s, "month")
    return scheduleText(s, "two_weeks")
  }
  if (["help", "start", "pomosh", "помощь"].includes(cmd)) return HELP_TEXT
  return null
}

async function handle(u: Update, chats: Map<string, BotChat>, log: Log) {
  const chat = u.message?.chat ?? u.my_chat_member?.chat
  if (!chat) return
  const id = String(chat.id)
  const left = ["left", "kicked"].includes(u.my_chat_member?.new_chat_member?.status ?? "")
  if (left) chats.delete(id)
  else chats.set(id, { id, title: chatTitle(chat), type: chat.type, seen_at: new Date().toISOString() })

  const msg = u.message
  if (!msg) return
  const s = await loadShifts()
  // Группа стала супергруппой — у чата новый номер
  if (msg.migrate_to_chat_id && s.chat_id === id) {
    await saveShifts({ chat_id: String(msg.migrate_to_chat_id), chat_title: s.chat_title })
    return
  }
  if (!msg.text?.startsWith("/")) return
  // Отвечаем только в рабочем чате и в чате уведомлений магазина
  const allowed = [s.chat_id, process.env.TELEGRAM_CHAT_ID ?? ""].filter(Boolean)
  if (!allowed.includes(id)) return
  const reply = await answer(msg.text)
  if (reply) await send(id, reply).catch((e: Error) => log.warn(`Смены: ответ не отправлен: ${e.message}`))
}

/** Одна минута работы бота: напоминание + приём команд */
export async function shiftsTick(log: Log) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return
  await remindIfDue(log).catch((e: Error) => log.warn(`Смены: ${e.message}`))

  const started = Date.now()
  const bot = await loadBot()
  let offset = bot.offset
  const chats = new Map(bot.chats.map((c) => [c.id, c]))
  let error = ""
  while (Date.now() - started < LISTEN_MS) {
    const wait = Math.max(1, Math.min(25, Math.floor((LISTEN_MS - (Date.now() - started)) / 1000)))
    let updates: Update[]
    try {
      updates = await telegramApi<Update[]>("getUpdates", { offset, timeout: wait, allowed_updates: ["message", "my_chat_member"] })
    } catch (e) {
      const m = (e as Error).message
      error = /webhook/i.test(m) ? "У бота включён вебхук — команды не принимаются (его можно снять методом deleteWebhook)" : m
      break
    }
    for (const u of updates) {
      offset = u.update_id + 1
      await handle(u, chats, log).catch((e: Error) => log.warn(`Смены: ${e.message}`))
    }
    if (updates.length) await patchBot({ offset, chats: [...chats.values()].slice(-20) })
  }
  if (error) {
    // Другой запуск ещё слушает — не ошибка
    if (/terminated by other getUpdates/i.test(error)) return
    if (error !== bot.poll_error) {
      log.warn(`Смены: бот не получает сообщения: ${error}`)
      await patchBot({ poll_error: error })
    }
    return
  }
  // Отметку «бот на связи» обновляем раз в 10 минут, чтобы не писать в базу каждую минуту
  if (bot.poll_error || !bot.poll_ok_at || Date.now() - Date.parse(bot.poll_ok_at) > 600_000) {
    await patchBot({ poll_error: "", poll_ok_at: new Date().toISOString() })
  }
}

/** Отправить напоминание прямо сейчас (кнопка в админке) */
export async function sendReminderNow() {
  const s = await loadShifts()
  if (!s.chat_id) throw new Error("Сначала выберите рабочий чат")
  await send(s.chat_id, reminderText(s))
}

/** Подсказки команд в меню Telegram (кнопка «/» в чате). Ошибку не показываем — это необязательно */
export async function registerCommands() {
  await telegramApi("setMyCommands", {
    commands: [
      { command: "smena", description: "Кто работает сегодня и завтра" },
      { command: "grafik", description: "График смен на 2 недели" },
    ],
  }).catch(() => undefined)
}
