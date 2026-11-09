import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EnvelopeSolid } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Switch, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Row = { email: string; created_at: string; promo_code: string | null; promo_used: boolean; unsubscribed: boolean }
type Resp = { subscribers: Row[]; total: number; active: number }

/** Рассылка: подписка в подвале сайта, скидка по одноразовому промокоду, список подписчиков. */
const NewsletterPage = () => {
  const [enabled, setEnabled] = useState(true)
  const [pct, setPct] = useState("10")
  const [data, setData] = useState<Resp | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([
      fetch("/admin/shop-settings", { credentials: "include" }).then((r) => r.json()),
      fetch("/admin/newsletter", { credentials: "include" }).then((r) => r.json()),
    ])
    const n = (s as { settings?: { newsletter?: { enabled: boolean; discount_pct: number } } }).settings?.newsletter
    if (n) { setEnabled(n.enabled); setPct(String(n.discount_pct)) }
    setData(l as Resp)
  }, [])
  useEffect(() => { load().catch(() => toast.error("Не загрузилось")) }, [load])

  const save = async () => {
    setBusy(true)
    try {
      const r = await fetch("/admin/shop-settings", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletter: { enabled, discount_pct: Number(pct) } }),
      })
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "Не сохранилось")
      toast.success("Сохранено")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const usedCount = data?.subscribers.filter((s) => s.promo_used).length ?? 0
  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h1">Рассылка</Heading>
          <Text size="small" className="text-ui-fg-subtle">Форма «Подпишитесь на новости» в подвале сайта. Новый подписчик получает письмо с одноразовым промокодом — только для него.</Text>
        </div>
        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Switch id="nl-on" checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor="nl-on">Показывать форму подписки на сайте</Label>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="nl-pct" size="small">Скидка за подписку, %</Label>
              <Input id="nl-pct" type="number" min={0} max={50} value={pct} onChange={(e) => setPct(e.target.value)} className="mt-1 w-32" />
            </div>
            <Button size="small" onClick={save} isLoading={busy}>Сохранить</Button>
          </div>
          <Text size="small" className="text-ui-fg-subtle">0 — подписка без промокода. Промокод действует на один заказ, со скидкой Laflamme Club не суммируется (сайт применит выгодную). Изменение скидки касается новых подписчиков.</Text>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Подписчики</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {data ? `Всего: ${data.total} · подписаны: ${data.active} · использовали промокод: ${usedCount}` : "Загружаем…"}
            </Text>
          </div>
          <a href="/admin/newsletter?format=csv" className="text-ui-fg-interactive text-sm">Скачать CSV (Excel)</a>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Дата</Table.HeaderCell>
              <Table.HeaderCell>Промокод</Table.HeaderCell>
              <Table.HeaderCell>Статус</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(data?.subscribers ?? []).slice(0, 200).map((s) => (
              <Table.Row key={s.email}>
                <Table.Cell>{s.email}</Table.Cell>
                <Table.Cell>{new Date(s.created_at).toLocaleDateString("ru-RU")}</Table.Cell>
                <Table.Cell>{s.promo_code ?? "—"}{s.promo_used && <Badge size="2xsmall" color="green" className="ml-2">использован</Badge>}</Table.Cell>
                <Table.Cell>{s.unsubscribed ? <Badge size="2xsmall" color="grey">отписался</Badge> : <Badge size="2xsmall" color="blue">подписан</Badge>}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {!!data && data.total > 200 && <Text size="small" className="px-6 py-3 text-ui-fg-subtle">Показаны последние 200 — все в CSV.</Text>}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Рассылка",
  icon: EnvelopeSolid,
})

export default NewsletterPage
