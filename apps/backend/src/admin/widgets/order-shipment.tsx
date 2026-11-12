import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type F = { id: string; provider: string; tracking_number: string | null; shipped_at: string | null; delivered_at: string | null }

const date = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

/**
 * «Отправка»: отметить сборку отправленной с трек-номером — покупателю уходит письмо с треком.
 * Вместо стандартной формы Medusa: она требует ссылку на этикетку и не сохраняется с пустыми полями.
 * СДЭК отмечает отправку сам, когда принимает посылку; трек подставляется из заказа СДЭК.
 */
const OrderShipmentWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [rows, setRows] = useState<F[] | null>(null)
  const [track, setTrack] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/admin/order-shipment/${order.id}`, { credentials: "include" })
    const list = ((await r.json()) as { fulfillments: F[] }).fulfillments ?? []
    setRows(list)
    setTrack((t) => Object.fromEntries(list.map((f) => [f.id, t[f.id] ?? f.tracking_number ?? ""])))
  }, [order.id])
  useEffect(() => { load().catch(() => setRows([])) }, [load])

  const ship = async (f: F) => {
    setBusy(f.id)
    try {
      const r = await fetch(`/admin/order-shipment/${order.id}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillment_id: f.id, tracking_number: track[f.id] ?? "" }),
      })
      const d = (await r.json().catch(() => ({}))) as { message?: string }
      if (!r.ok) throw new Error(d.message ?? "Не получилось")
      toast.success("Отмечено отправленным — покупателю ушло письмо")
      // Страница заказа обновится со статусом «Отправлен»
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!rows?.length) return null
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Отправка</Heading>
        <Text size="small" className="text-ui-fg-subtle">Трек-номер и письмо покупателю. Ссылка на отслеживание добавится сама.</Text>
      </div>
      {rows.map((f) => (
        <div key={f.id} className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex items-center justify-between">
            <Text size="small" weight="plus">{f.provider}</Text>
            {f.delivered_at ? <Badge color="green">Доставлен</Badge> : f.shipped_at ? <Badge color="blue">Отправлен</Badge> : <Badge color="orange">Не отправлен</Badge>}
          </div>
          {f.shipped_at ? (
            <Text size="small" className="text-ui-fg-subtle">
              {date(f.shipped_at)}{f.tracking_number ? ` · трек ${f.tracking_number}` : ""}
            </Text>
          ) : (
            <>
              <div className="flex flex-col gap-y-1">
                <Label size="small" htmlFor={`trk-${f.id}`}>Трек-номер (необязательно)</Label>
                <Input id={`trk-${f.id}`} size="small" value={track[f.id] ?? ""} placeholder="СДЭК или Почта России"
                  onChange={(e) => setTrack((t) => ({ ...t, [f.id]: e.target.value }))} />
              </div>
              <Button size="small" isLoading={busy === f.id} onClick={() => ship(f)}>Отметить отправленным</Button>
            </>
          )}
        </div>
      ))}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.details.side.before" })

export default OrderShipmentWidget
