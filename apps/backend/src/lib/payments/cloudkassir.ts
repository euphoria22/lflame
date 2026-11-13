/**
 * CloudKassir (облачная касса CloudPayments): чек напрямую через API — для заказа сайта,
 * целиком оплаченного подарочной картой. Онлайн-платежа нет, поэтому Т-Касса чек не пробьёт,
 * а чек при передаче товара нужен: «зачёт аванса» (деньги получены раньше — при продаже карты).
 *
 * Документация: https://developers.cloudkassir.ru/ — POST https://api.cloudpayments.ru/kkt/receipt,
 * HTTP Basic (Public ID / API Secret), заголовок X-Request-ID — повтор не пробьёт второй чек.
 * Ключи на сервере: CLOUDKASSIR_PUBLIC_ID, CLOUDKASSIR_API_SECRET, CLOUDKASSIR_INN;
 * система налогообложения — CLOUDKASSIR_TAXATION (по умолчанию 1 — УСН «доходы»).
 */

export type CkLine = { label: string; price: number; quantity: number; amount: number; kind: "commodity" | "service" }

export function cloudKassirConfigured(): boolean {
  return Boolean(process.env.CLOUDKASSIR_PUBLIC_ID && process.env.CLOUDKASSIR_API_SECRET && process.env.CLOUDKASSIR_INN)
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Чек «приход» с оплатой зачётом аванса: позиции — полный расчёт (товар/услуга, без НДС),
 * в оплате — только AdvancePayment на всю сумму. Сумма позиций должна совпасть с суммой оплаты.
 */
export function advanceOffsetReceipt(lines: CkLine[], opts: { inn: string; taxation: number; email?: string | null; invoiceId?: string }) {
  const items = lines.map((l) => ({
    Label: l.label.slice(0, 124),
    Price: r2(l.price),
    Quantity: l.quantity,
    Amount: r2(l.amount),
    Vat: null,
    Method: 4, // FullPay — полный расчёт
    Object: l.kind === "service" ? 4 : 1, // Service / Commodity
  }))
  const total = r2(items.reduce((s, i) => s + i.Amount, 0))
  return {
    Inn: opts.inn,
    Type: "Income",
    InvoiceId: opts.invoiceId,
    CustomerReceipt: {
      Items: items,
      TaxationSystem: opts.taxation,
      Amounts: { AdvancePayment: total },
      Email: opts.email || undefined,
      IsInternetPayment: true,
    },
  }
}

/** Отправить чек. requestId — один и тот же для одного заказа: повтор не создаст второй чек. */
export async function sendCloudKassirReceipt(body: unknown, requestId: string): Promise<{ ok: boolean; message: string | null }> {
  const auth = Buffer.from(`${process.env.CLOUDKASSIR_PUBLIC_ID}:${process.env.CLOUDKASSIR_API_SECRET}`).toString("base64")
  const res = await fetch("https://api.cloudpayments.ru/kkt/receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}`, "X-Request-ID": requestId },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  if (res.status === 401) return { ok: false, message: "CloudKassir: неверные Public ID или API Secret" }
  const d = (await res.json().catch(() => null)) as { Success?: boolean; Message?: string | null } | null
  return { ok: Boolean(d?.Success), message: d?.Message ?? (res.ok ? null : `HTTP ${res.status}`) }
}
