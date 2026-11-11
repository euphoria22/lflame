import { sendTelegram } from "../lib/notify/telegram"

/**
 * Проверка уведомлений в Telegram: отправляет тестовое сообщение магазину.
 *   npx medusa exec ./src/scripts/telegram-test.js
 */
export default async function telegramTest() {
  console.log(`Посредник: ${process.env.TELEGRAM_API_URL || "нет (напрямую api.telegram.org)"}`)
  let failed = false
  await sendTelegram("✅ Проверка: уведомления сайта Laflamme приходят в Telegram", {
    info: (m) => { failed = true; console.log(m) },
    warn: (m) => { failed = true; console.log(`ОШИБКА: ${m}`) },
  })
  console.log(failed ? "Не отправлено — см. строку выше" : "Отправлено — проверьте Telegram")
}
