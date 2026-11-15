import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addPhoto, publicTask } from "../../../../../../../lib/merch/tasks"

/** Фото результата к шагу (JPEG из браузера, уже уменьшенный) */
export async function POST(req: MedusaRequest<{ data?: string }>, res: MedusaResponse) {
  try {
    res.json(publicTask(await addPhoto(req.scope, req.params.token, req.params.sid, String(req.body?.data ?? ""))))
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
