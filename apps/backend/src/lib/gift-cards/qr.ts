import QRCode from "qrcode"
import { site } from "../notify/templates"
import { normalizeCode } from "./rules"

/**
 * QR подарочной карты — ссылка на её страницу на сайте (/gift-cards/card/<код>):
 * покупатель видит остаток, продавец в шоуруме сканирует камерой телефона и открывает карту в админке.
 */
export const cardUrl = (code: string) => `${site()}/gift-cards/card/${normalizeCode(code)}`

export function qrPng(code: string, width = 360): Promise<Buffer> {
  return QRCode.toBuffer(cardUrl(code), { type: "png", width, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0b0bff", light: "#ffffffff" } })
}
