import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type F = {
  id: string
  created_at: string
  shipped_at: string | null
  delivered_at: string | null
  canceled_at: string | null
  data: Record<string, string | number | boolean | null> | null
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "")

/** Блок «СДЭК» в заказе: накладная, статус, ярлык, отслеживание. */
const OrderCdekWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [items, setItems] = useState<F[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/admin/cdek/fulfillments/${order.id}`, { credentials: "include" })
    setItems(((await r.json()) as { fulfillments: F[] }).fulfillments)
  }, [order.id])
  useEffect(() => { load().catch(() => setItems([])) }, [load])

  const sync = async (id: string) => {
    setBusy(id)
    const r = await fetch(`/admin/cdek/sync/${id}`, { method: "POST", credentials: "include" })
    setBusy(null)
    if (!r.ok) toast.error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "СДЭК не ответил")
    else { toast.success("Статус обновлён"); await load() }
  }

  const isCdek = order.shipping_methods?.some((m) => /СДЭК/i.test(m.name))
  if (!isCdek && !items?.length) return null

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4"><Heading level="h2">СДЭК</Heading></div>
      {items === null ? (
        <Text size="small" className="px-6 py-4">Загрузка…</Text>
      ) : !items.length ? (
        <Text size="small" className="px-6 py-4 text-ui-fg-subtle">
          Заказ ещё не передан в СДЭК. Нажмите «Создать отправку» в блоке «Неотправленные товары» — заказ появится в СДЭК, здесь будет номер и ярлык.
        </Text>
      ) : items.map((f) => {
        const d = f.data ?? {}
        return (
          <div key={f.id} className="flex flex-col gap-y-2 px-6 py-4">
            <div className="flex items-center justify-between">
              <Text size="small" weight="plus">{d.cdek_number ? `Накладная ${d.cdek_number}` : "Номер накладной ещё не присвоен"}</Text>
              {f.canceled_at ? <Badge color="grey">Отменена</Badge>
                : d.cdek_error ? <Badge color="red">Ошибка</Badge>
                  : f.delivered_at ? <Badge color="green">Вручён</Badge>
                    : <Badge color="blue">{String(d.cdek_status_name ?? "Принят")}</Badge>}
            </div>
            {d.cdek_error && <Text size="small" className="text-ui-fg-error">{String(d.cdek_error)}</Text>}
            <Text size="small" className="text-ui-fg-subtle">
              {d.pvz_code ? `Пункт выдачи ${d.pvz_code}: ${d.pvz_address ?? ""}` : "Курьер"} · {d.city ?? ""}
              {d.cod ? " · оплата при получении" : " · оплачено онлайн"}
            </Text>
            {d.cdek_status_at && <Text size="small" className="text-ui-fg-subtle">Обновлено: {fmt(String(d.cdek_status_at))}</Text>}
            {!f.canceled_at && (
              <div className="flex flex-wrap gap-2 pt-1">
                {d.cdek_number && <Button size="small" variant="secondary" asChild><a href={`/admin/cdek/label/${d.cdek_uuid}`} target="_blank" rel="noreferrer">Ярлык PDF</a></Button>}
                {d.cdek_number && <Button size="small" variant="secondary" asChild><a href={`https://www.cdek.ru/ru/tracking/?order_id=${d.cdek_number}`} target="_blank" rel="noreferrer">Отследить</a></Button>}
                <Button size="small" variant="transparent" isLoading={busy === f.id} onClick={() => sync(f.id)}>Обновить статус</Button>
              </div>
            )}
          </div>
        )
      })}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.details.side.after" })

export default OrderCdekWidget
