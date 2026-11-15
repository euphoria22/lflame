import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EnvelopeSolid } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Switch, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Row = { email: string; created_at: string; promo_code: string | null; promo_used: boolean; unsubscribed: boolean }
type Abandoned = { enabled: boolean; delay_hours: number; consent_only: boolean; discount_pct: number }
type AbStats = { sent: number; clicked: number; recovered: number; revenue: number }
type Resp = { subscribers: Row[]; total: number; active: number; abandoned?: AbStats | null }

/** Письмо о брошенной корзине: включить, через сколько часов, кому, скидка; статистика за 30 дней; пробное письмо себе */
const AbandonedBlock = ({ value, stats, onSaved }: { value: Abandoned; stats: AbStats | null | undefined; onSaved: () => void }) => {
  const [v, setV] = useState(value)
  const [busy, setBusy] = useState<string | null>(null)
  const [testTo, setTestTo] = useState("")
  useEffect(() => { setV(value) }, [value])
  const changed = JSON.stringify(v) !== JSON.stringify(value)
  const save = async () => {
    setBusy("save")
    try {
      const r = await fetch("/admin/shop-settings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ abandoned_cart: v }) })
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "Не сохранилось")
      toast.success("Сохранено")
      onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const test = async () => {
    setBusy("test")
    try {
      const r = await fetch("/admin/abandoned/send-test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: testTo }) })
      const d = (await r.json().catch(() => ({}))) as { message?: string; to?: string }
      if (!r.ok) throw new Error(d.message ?? `Не отправилось (ответ сервера ${r.status})`)
      toast.success(`Пробное письмо отправлено на ${d.to}`)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—")
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Брошенная корзина</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Если покупатель указал почту (при оформлении или вошёл в кабинет), положил товары и не оформил заказ — через заданное время ему приходит письмо
          с товарами из корзины и кнопкой «Вернуться к корзине». Корзина открывается на любом устройстве. Одно письмо на корзину;
          не пишем, если по этому адресу уже был заказ, товаров нет в наличии или человек отписался.
        </Text>
      </div>
      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Switch id="ab-on" checked={v.enabled} onCheckedChange={(enabled) => setV({ ...v, enabled })} />
          <Label htmlFor="ab-on">Отправлять письма о брошенной корзине</Label>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label size="small">Через сколько часов</Label>
            <Input type="number" min={0.5} max={72} step={0.5} value={String(v.delay_hours)} onChange={(e) => setV({ ...v, delay_hours: Number(e.target.value) })} className="mt-1 w-32" />
          </div>
          <div>
            <Label size="small">Скидка в письме, %</Label>
            <Input type="number" min={0} max={30} value={String(v.discount_pct)} onChange={(e) => setV({ ...v, discount_pct: Number(e.target.value) })} className="mt-1 w-32" />
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <Switch id="ab-consent" checked={v.consent_only} onCheckedChange={(consent_only) => setV({ ...v, consent_only })} />
            <Label size="small" htmlFor="ab-consent">Только тем, кто отметил «Хочу получать новости»</Label>
          </div>
          <Button size="small" disabled={!changed} isLoading={busy === "save"} onClick={save}>Сохранить</Button>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Скидка 0 — письмо без промокода. С промокодом каждому письму создаётся свой одноразовый код (BACK-…), он сам применяется при возврате по кнопке.
        </Text>
      </div>
      {stats && (
        <div className="grid grid-cols-2 gap-3 px-6 py-4 md:grid-cols-4">
          {[["Писем за 30 дней", String(stats.sent)], ["Вернулись по ссылке", `${stats.clicked} · ${pct(stats.clicked, stats.sent)}`], ["Оформили заказ", `${stats.recovered} · ${pct(stats.recovered, stats.sent)}`], ["Сумма этих заказов", `${stats.revenue.toLocaleString("ru-RU")} ₽`]].map(([l, x]) => (
            <div key={l} className="rounded-lg border border-ui-border-base px-4 py-3"><Text size="xsmall" className="text-ui-fg-subtle">{l}</Text><Text size="large" weight="plus">{x}</Text></div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3 px-6 py-4">
        <div>
          <Label size="small">Пробное письмо себе</Label>
          <Input type="email" placeholder="Ваша почта (пусто — почта входа в админку)" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="mt-1 w-80" />
        </div>
        <Button size="small" variant="secondary" isLoading={busy === "test"} onClick={test}>Отправить пробное</Button>
      </div>
    </Container>
  )
}

/** Рассылка: подписка в подвале сайта, скидка по одноразовому промокоду, список подписчиков. */
const NewsletterPage = () => {
  const [enabled, setEnabled] = useState(true)
  const [pct, setPct] = useState("10")
  const [data, setData] = useState<Resp | null>(null)
  const [abandoned, setAbandoned] = useState<Abandoned | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([
      fetch("/admin/shop-settings", { credentials: "include" }).then((r) => r.json()),
      fetch("/admin/newsletter", { credentials: "include" }).then((r) => r.json()),
    ])
    const n = (s as { settings?: { newsletter?: { enabled: boolean; discount_pct: number } } }).settings?.newsletter
    if (n) { setEnabled(n.enabled); setPct(String(n.discount_pct)) }
    const a = (s as { settings?: { abandoned_cart?: Abandoned } }).settings?.abandoned_cart
    if (a) setAbandoned(a)
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

      {abandoned && <AbandonedBlock value={abandoned} stats={data?.abandoned} onSaved={() => { load().catch(() => null) }} />}

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
