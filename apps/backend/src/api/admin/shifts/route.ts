import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { registerCommands } from "../../../lib/shifts/bot"
import { loadBot, loadShifts, omskNow, saveShifts, Shifts } from "../../../lib/shifts/shifts"

/** График смен для админки: график, настройки напоминания, чаты, где есть бот, и состояние бота */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const [shifts, bot] = await Promise.all([loadShifts(), loadBot()])
  res.json({
    shifts,
    today: omskNow().date,
    bot: {
      configured: !!process.env.TELEGRAM_BOT_TOKEN,
      ok_at: bot.poll_ok_at || null,
      error: bot.poll_error || null,
      last_sent: bot.last_sent || null,
      chats: bot.chats,
    },
  })
}

export async function POST(req: MedusaRequest<Partial<Shifts>>, res: MedusaResponse) {
  try {
    const before = await loadShifts()
    const shifts = await saveShifts(req.body ?? {})
    if (shifts.chat_id && shifts.chat_id !== before.chat_id) await registerCommands()
    res.json({ shifts })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
