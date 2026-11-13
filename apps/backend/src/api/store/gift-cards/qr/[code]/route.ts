import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { qrPng } from "../../../../../lib/gift-cards/qr"
import { looksLikeCode } from "../../../../../lib/gift-cards/rules"

/** QR-код карты (PNG) для страницы карты на сайте. Есть ли такая карта — не проверяем: QR лишь повторяет код */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const code = String(req.params.code ?? "")
  if (!looksLikeCode(code)) { res.status(404).json({ message: "Не найдено" }); return }
  res.setHeader("Content-Type", "image/png")
  res.setHeader("Cache-Control", "public, max-age=86400")
  res.send(await qrPng(code, 480))
}
