import { MedusaContainer } from "@medusajs/framework/types"
import { esc, telegramApi } from "../notify/telegram"
import { dayCrew, loadShifts, omskNow, weekday } from "../shifts/shifts"
import { Checklist } from "./autofill"
import { loadMerchSettings } from "./settings"
import { checklistSentOn, createChecklistTask, taskUrl } from "./tasks"

/**
 * Повторяющиеся чек-листы (ТЗ, п. 3.16): в заданные дни и время по Омску создаётся задание-чек-лист
 * и ссылка уходит в рабочий чат (из «Смен») с упоминанием тех, кто сегодня на смене.
 */

type Log = { info: (m: string) => void; warn: (m: string) => void }

export async function sendChecklist(c: MedusaContainer, cl: Checklist, date = omskNow().date) {
  const task = await createChecklistTask(c, cl, date)
  const shifts = await loadShifts()
  const chat = shifts.chat_id || process.env.TELEGRAM_CHAT_ID
  if (!chat) return { task, sent: false }
  const crew = dayCrew(shifts, date).work.map((p) => (p.tg ? `${esc(p.name)} (@${p.tg})` : esc(p.name)))
  const text = [
    `📋 <b>${esc(cl.name)}</b>${crew.length ? ` — на смене: ${crew.join(", ")}` : ""}`,
    `${cl.items.length} пунктов. Отмечайте на телефоне, где нужно — фото:`,
    taskUrl(task.token),
  ].join("\n")
  await telegramApi("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true })
  return { task, sent: true }
}

/** Раз в минуту: какие чек-листы пора отправить (не позже 3 часов после времени, один раз в день) */
export async function checklistsTick(c: MedusaContainer, log: Log) {
  const settings = await loadMerchSettings()
  const now = omskNow()
  const wd = weekday(now.date)
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  for (const cl of settings.checklists) {
    if (!cl.enabled || !cl.days.includes(wd)) continue
    const late = mins(now.time) - mins(cl.time)
    if (late < 0 || late > 180) continue
    if (await checklistSentOn(c, cl.id, now.date)) continue
    await sendChecklist(c, cl, now.date).catch((e: Error) => log.warn(`Чек-лист «${cl.name}» не отправлен: ${e.message}`))
  }
}
