import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendReminderNow } from "../../../../lib/shifts/bot"

/** Отправить напоминание о сменах в рабочий чат прямо сейчас */
export async function POST(_req: MedusaRequest, res: MedusaResponse) {
  try {
    await sendReminderNow()
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
