import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getTask, publicTask } from "../../../../../lib/merch/tasks"

/** Задание для страницы консультанта (по секретной ссылке, без входа) */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex")
  try {
    res.json(publicTask(await getTask(req.scope, { token: req.params.token })))
  } catch {
    res.status(404).json({ message: "Задание не найдено — ссылка устарела или задание удалено" })
  }
}
