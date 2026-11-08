import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type P = { id: string; payment_id: string | null; amount: number; refunded: number; captured_at: string | null; status: string | null; error: string | null }

const STATUS: Record<string, { label: string; color: "green" | "orange" | "red" | "grey" | "blue" }> = {
  CONFIRMED: { label: "Оплачен", color: "green" },
  AUTHORIZED: { label: "Деньги заморожены", color: "blue" },
  PARTIAL_REFUNDED: { label: "Частичный возврат", color: "orange" },
  REFUNDED: { label: "Возвращён", color: "grey" },
  REVERSED: { label: "Отменён", color: "grey" },
  CANCELED: { label: "Отменён", color: "grey" },
  REJECTED: { label: "Отклонён банком", color: "red" },
  NEW: { label: "Не оплачен", color: "orange" },
  FORM_SHOWED: { label: "Не оплачен", color: "orange" },
}

const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`

/** Блок «Т-Касса» в заказе: номер платежа в Т-Кассе, статус, возвраты. */
const OrderTbankWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [rows, setRows] = useState<P[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (check = false) => {
    const r = await fetch(`/admin/tbank/payments/${order.id}${check ? "?check=1" : ""}`, { credentials: "include" })
    setRows(((await r.json()) as { payments: P[] }).payments)
  }, [order.id])
  useEffect(() => { load().catch(() => setRows([])) }, [load])

  if (!rows?.length) return null

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4"><Heading level="h2">Т-Касса</Heading></div>
      {rows.map((p) => {
        const s = STATUS[p.status ?? ""] ?? { label: p.status ?? "—", color: "grey" as const }
        return (
          <div key={p.id} className="flex flex-col gap-y-2 px-6 py-4">
            <div className="flex items-center justify-between">
              <Text size="small" weight="plus">Платёж {p.payment_id ?? "—"}</Text>
              <Badge color={s.color}>{s.label}</Badge>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Сумма {rub(p.amount)}{p.refunded ? ` · возвращено ${rub(p.refunded)}` : ""}
            </Text>
            {p.error && <Text size="small" className="text-ui-fg-error">{p.error}</Text>}
            <Text size="small" className="text-ui-fg-subtle">Возврат: блок «Платежи» → ⋯ → «Возврат». Деньги вернутся на карту покупателя.</Text>
            <div><Button size="small" variant="transparent" isLoading={busy} onClick={async () => { setBusy(true); await load(true); setBusy(false) }}>Проверить в Т-Кассе</Button></div>
          </div>
        )
      })}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.details.side.after" })

export default OrderTbankWidget
