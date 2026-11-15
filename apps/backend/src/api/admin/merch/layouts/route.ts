import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffEmail } from "../../../../lib/admin/staff"
import { createLayout, listLayouts } from "../../../../lib/merch/layouts"

/** Варианты расстановки зала: список и создание */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ layouts: await listLayouts(req.scope) })
}

export async function POST(req: AuthenticatedMedusaRequest<{ name?: string; data?: unknown }>, res: MedusaResponse) {
  try {
    const layout = await createLayout(req.scope, req.body?.name ?? "", req.body?.data, await staffEmail(req))
    res.json({ layout })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
