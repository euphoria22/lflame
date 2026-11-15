import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffEmail } from "../../../../lib/admin/staff"
import { createTask, listTasks, StepInput, taskUrl } from "../../../../lib/merch/tasks"

/** Задания консультантам: список и создание */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ tasks: await listTasks(req.scope) })
}

export async function POST(req: AuthenticatedMedusaRequest<{ layout_id: string; name: string; note?: string; steps: StepInput[] }>, res: MedusaResponse) {
  try {
    const t = await createTask(req.scope, req.body, await staffEmail(req))
    res.json({ task: { id: t.id, url: taskUrl(t.token) } })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
