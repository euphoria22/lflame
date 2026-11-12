import type { ReceiptLine } from "./tbank-client"

/**
 * Яндекс Пэй (Сплит) — Merchant API: https://pay.yandex.ru/docs/ru/custom/backend/yandex-pay-api/
 * Ключ — в заголовке «Authorization: Api-Key …». В тестовой среде (sandbox) ключом служит Merchant ID магазина.
 */
export type YandexPayConfig = { apiUrl: string; apiKey: string }

export const YANDEX_PAY_PROD = "https://pay.yandex.ru/api/merchant"
export const YANDEX_PAY_SANDBOX = "https://sandbox.pay.yandex.ru/api/merchant"

export class YandexPayError extends Error {
  constructor(message: string, readonly status?: number, readonly reasonCode?: string) {
    super(message)
  }
}

export async function yandexPayCall<T>(cfg: YandexPayConfig, method: "GET" | "POST", path: string, body?: unknown, requestId?: string): Promise<T> {
  const res = await fetch(`${cfg.apiUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: {
      Authorization: `Api-Key ${cfg.apiKey}`,
      "Content-Type": "application/json",
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => ({}))) as { status?: string; data?: T; reasonCode?: string; reason?: string }
  if (!res.ok || json.status !== "success") {
    throw new YandexPayError(`Яндекс Пэй: ${res.status} ${json.reasonCode ?? ""} ${json.reason ?? ""}`.trim(), res.status, json.reasonCode)
  }
  return json.data as T
}

export const money = (rub: number) => (Math.round(rub * 100) / 100).toFixed(2)

/**
 * Корзина для Яндекс Пэй: все позиции (по закону о рассрочке Сплит требует состав заказа) и доставка отдельной позицией.
 * Данные для чека: «без НДС» (6, УСН), полная предоплата (1), товар (1) / услуга (4).
 */
export function buildCart(lines: ReceiptLine[]) {
  const items = lines.map((l, i) => ({
    // id размера (variant) — тот же, что в бейджах Сплита на витрине
    productId: l.id ?? `item-${i + 1}`,
    title: l.name.slice(0, 1000),
    quantity: { count: String(l.quantity) },
    unitPrice: money(l.price),
    total: money(l.price * l.quantity),
    receipt: { tax: 6, measure: 0, paymentMethodType: 1, paymentSubjectType: l.kind === "service" ? 4 : 1, title: l.name.slice(0, 128) },
  }))
  const total = lines.reduce((s, l) => s + Math.round(l.price * 100) * l.quantity, 0) / 100
  return { items, total: { amount: money(total) } }
}

export type YandexOrder = { orderId: string; paymentStatus: string; paymentUrl?: string; orderAmount?: string }

/** Статус платежа Яндекс Пэй → статус платёжной сессии Medusa. */
export function toSessionStatus(s?: string): "pending" | "authorized" | "captured" | "error" | "canceled" {
  switch (s) {
    case "CAPTURED":
    case "CONFIRMED":
      return "captured"
    case "AUTHORIZED":
      return "authorized"
    case "FAILED":
      return "error"
    case "VOIDED":
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "canceled"
    default:
      return "pending"
  }
}

/** Payload JWT из вебхука (без проверки подписи: статус потом всё равно запрашивается у Яндекс Пэй по ключу). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.trim().split(".")[1]
  if (!part) return null
  try {
    return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"))
  } catch {
    return null
  }
}

/** Оплачен онлайн до создания заказа: Т-Касса или Сплит (заказ создаётся только после оплаты). */
export const isPaidOnline = (method: unknown) => method === "tbank" || method === "split"
