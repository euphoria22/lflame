import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { markStep, publicTask } from "../../../../../../lib/merch/tasks"
import { esc, sendTelegram } from "../../../../../../lib/notify/telegram"

/** Консультант отмечает шаг сделанным (или снимает отметку). Когда сделано всё — сообщение в Telegram */
export async function POST(req: MedusaRequest<{ done?: boolean; who?: string }>, res: MedusaResponse) {
  try {
    const { task, finished } = await markStep(req.scope, req.params.token, req.params.sid, !!req.body?.done, req.body?.who ? String(req.body.who) : null)
    if (finished) {
      const photos = task.steps.reduce((a, s) => a + s.photos.length, 0)
      await sendTelegram(`✅ Выкладка «${esc(task.name)}» выполнена: ${task.steps.length} шагов, фото: ${photos}. Проверить — «Мерчендайзинг» → «Задания» в админке.`, req.scope.resolve("logger"))
    }
    res.json(publicTask(task))
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
