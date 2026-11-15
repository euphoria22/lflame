import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteTask, getTask, reviewTask, taskUrl } from "../../../../../lib/merch/tasks"

/** Задание: открыть, проверить (замечания, «принято»/«переделать», закрыть), удалить */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const t = await getTask(req.scope, { id: req.params.id })
    res.json({ task: { ...t, token: undefined, url: taskUrl(t.token) } })
  } catch (e) {
    res.status(404).json({ message: (e as Error).message })
  }
}

export async function POST(req: AuthenticatedMedusaRequest<Parameters<typeof reviewTask>[2]>, res: MedusaResponse) {
  try {
    const t = await reviewTask(req.scope, req.params.id, req.body ?? {})
    res.json({ task: { ...t, token: undefined, url: taskUrl(t.token) } })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    await deleteTask(req.scope, req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
