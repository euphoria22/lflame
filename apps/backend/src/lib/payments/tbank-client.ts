import { createHash } from "node:crypto"

/**
 * Клиент API Т-Кассы v2 (интернет-эквайринг Т-Банка).
 * Подпись Token: значения корневых параметров (без вложенных объектов) + Password,
 * отсортированные по имени ключа, склеиваются в строку и хешируются SHA-256.
 */
export type TbankConfig = { apiUrl: string; terminalKey: string; password: string; taxation?: string }

export function tbankToken(params: Record<string, unknown>, password: string): string {
  const flat: Record<string, string> = { Password: password }
  for (const [k, v] of Object.entries(params)) {
    if (k === "Token" || v === undefined || v === null || typeof v === "object") continue
    flat[k] = String(v)
  }
  const joined = Object.keys(flat).sort().map((k) => flat[k]).join("")
  return createHash("sha256").update(joined, "utf8").digest("hex")
}

export type TbankResponse = {
  Success: boolean
  ErrorCode: string
  Message?: string
  Details?: string
  Status?: string
  PaymentId?: string | number
  OrderId?: string
  Amount?: number
  PaymentURL?: string
}

export class TbankError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export async function tbankCall(cfg: TbankConfig, method: string, params: Record<string, unknown>): Promise<TbankResponse> {
  const body = { TerminalKey: cfg.terminalKey, ...params }
  const res = await fetch(`${cfg.apiUrl.replace(/\/+$/, "")}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, Token: tbankToken(body, cfg.password) }),
  })
  const data = (await res.json().catch(() => ({ Success: false, ErrorCode: String(res.status) }))) as TbankResponse
  if (!data.Success) throw new TbankError(data.ErrorCode, `Т-Касса ${method}: ${data.Message ?? "ошибка"}${data.Details ? ` (${data.Details})` : ""}`)
  return data
}

/** Проверка подписи уведомления от Т-Кассы. */
export function tbankVerify(payload: Record<string, unknown>, password: string): boolean {
  return typeof payload.Token === "string" && payload.Token === tbankToken(payload, password)
}

/** Рубли -> копейки. */
export const kopecks = (rub: number) => Math.round(rub * 100)

export type ReceiptLine = { name: string; price: number; quantity: number; kind?: "commodity" | "service" }

/** Чек 54-ФЗ (если касса подключена в Т-Кассе). НДС — «без НДС» (УСН). */
export function buildReceipt(lines: ReceiptLine[], contact: { email?: string | null; phone?: string | null }, taxation: string) {
  return {
    Email: contact.email || undefined,
    Phone: contact.email ? undefined : contact.phone || undefined,
    Taxation: taxation,
    Items: lines.map((l) => ({
      Name: l.name.slice(0, 128),
      Price: kopecks(l.price),
      Quantity: l.quantity,
      Amount: kopecks(l.price * l.quantity),
      Tax: "none",
      PaymentMethod: "full_prepayment",
      PaymentObject: l.kind ?? "commodity",
    })),
  }
}
