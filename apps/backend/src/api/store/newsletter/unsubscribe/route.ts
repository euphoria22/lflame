import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { unsubscribeNewsletter } from "../../../../lib/newsletter/newsletter"

/** Отписка по ссылке из письма (адрес + подпись). */
export async function POST(req: MedusaRequest<{ email?: string; token?: string }>, res: MedusaResponse) {
  const ok = await unsubscribeNewsletter(req.scope, String(req.body?.email ?? ""), String(req.body?.token ?? ""))
  res.status(ok ? 200 : 400).json({ ok })
}
