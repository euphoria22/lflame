import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getTask, taskUrl } from "../../../../../../lib/merch/tasks"
import { esc, telegramApi } from "../../../../../../lib/notify/telegram"
import { loadShifts } from "../../../../../../lib/shifts/shifts"

/** Ссылку на задание — в рабочий чат (тот, что выбран в «Сменах»), иначе в чат уведомлений магазина */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const t = await getTask(req.scope, { id: req.params.id })
    const chat = (await loadShifts()).chat_id || process.env.TELEGRAM_CHAT_ID
    if (!chat) throw new Error("Не выбран рабочий чат — выберите его в разделе «Смены»")
    const text = [`🧥 <b>Задание по выкладке: ${esc(t.name)}</b>`, `${t.steps.length} шагов. Откройте ссылку на телефоне, отмечайте сделанное и прикладывайте фото:`, taskUrl(t.token)].join("\n")
    await telegramApi("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
