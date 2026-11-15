import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffEmail } from "../../../../../lib/admin/staff"
import { deleteLayout, getLayout, updateLayout } from "../../../../../lib/merch/layouts"

/** Один вариант расстановки: открыть, сохранить (название, содержимое, «текущая»), удалить */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    res.json({ layout: await getLayout(req.scope, req.params.id) })
  } catch (e) {
    res.status(404).json({ message: (e as Error).message })
  }
}

export async function POST(req: AuthenticatedMedusaRequest<{ name?: string; data?: unknown; is_current?: boolean }>, res: MedusaResponse) {
  try {
    res.json({ layout: await updateLayout(req.scope, req.params.id, req.body ?? {}, await staffEmail(req)) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    await deleteLayout(req.scope, req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
