import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { tbankCall } from "../../../../../lib/payments/tbank-client"

type Payment = { id: string; provider_id: string; amount: unknown; captured_at: string | null; canceled_at: string | null; data: Record<string, unknown> | null; refunds?: { amount: unknown }[] }

/**
 * Платежи Т-Кассы заказа для блока «Т-Касса» в карточке заказа.
 * ?check=1 — свежий статус из Т-Кассы (GetState).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "payment_collections.payments.id", "payment_collections.payments.provider_id", "payment_collections.payments.amount",
      "payment_collections.payments.captured_at", "payment_collections.payments.canceled_at", "payment_collections.payments.data",
      "payment_collections.payments.refunds.amount"],
    filters: { id: req.params.order_id },
  })
  const order = data[0] as { payment_collections?: { payments?: Payment[] }[] } | undefined
  const payments = (order?.payment_collections ?? []).flatMap((c) => c.payments ?? []).filter((p) => p.provider_id === "pp_tbank_tbank")
  const check = (req.query as { check?: string }).check === "1"
  const cfg = { apiUrl: process.env.TBANK_API_URL || "https://securepay.tinkoff.ru/v2", terminalKey: process.env.TBANK_TERMINAL_KEY ?? "", password: process.env.TBANK_PASSWORD ?? "" }
  const rows = await Promise.all(payments.map(async (p) => {
    let live: string | null = null
    let error: string | null = null
    if (check && p.data?.PaymentId && cfg.terminalKey) {
      try {
        live = (await tbankCall(cfg, "GetState", { PaymentId: String(p.data.PaymentId) })).Status ?? null
      } catch (e) {
        error = (e as Error).message
      }
    }
    return {
      id: p.id,
      payment_id: p.data?.PaymentId ?? null,
      amount: Number(p.amount),
      refunded: (p.refunds ?? []).reduce((s, r) => s + Number(r.amount), 0),
      captured_at: p.captured_at,
      status: live ?? (p.data?.Status as string | undefined) ?? null,
      error,
    }
  }))
  res.json({ payments: rows })
}
