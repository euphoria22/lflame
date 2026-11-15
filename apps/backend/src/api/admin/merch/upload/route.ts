import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadImage } from "../../../../lib/merch/tasks"

/** Картинка из 3D для задания (снимок оборудования) → адрес файла */
export async function POST(req: AuthenticatedMedusaRequest<{ data?: string; name?: string }>, res: MedusaResponse) {
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.data ?? ""))
  if (!m || m[2].length > 6_000_000) { res.status(400).json({ message: "Нужна картинка до 4 МБ" }); return }
  const safe = String(req.body?.name ?? "merch").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "merch"
  const url = await uploadImage(req.scope, `${safe}-${Date.now()}.${m[1] === "jpeg" ? "jpg" : "png"}`, `image/${m[1]}`, m[2])
  res.json({ url })
}
