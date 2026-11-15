import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STAFF_PAGE } from "../../../../lib/merch/staff-page"

/** Страница задания по выкладке для консультанта (телефон, без входа — по секретной ссылке) */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src * data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'")
  res.send(STAFF_PAGE)
}
