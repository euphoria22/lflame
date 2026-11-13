import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Gift } from "@medusajs/icons"
import { Badge, Button, Container, Drawer, Heading, Input, Label, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

type Settings = { enabled: boolean; amounts: number[]; min: number; max: number; validity_months: number }
type Row = {
  id: string; code: string; amount: number; balance: number; status: "pending" | "active" | "disabled"; expired: boolean; expires_at: string | null
  buyer_name: string | null; buyer_email: string | null; recipient_name: string | null; recipient_email: string | null
  send_at: string | null; sent_at: string | null; source: "site" | "admin"; created_at: string; paid_at: string | null; search: string
}
type Tx = { id: string; amount: number; kind: string; reference: string | null; note: string | null; created_by: string | null; created_at: string }
type Card = Omit<Row, "search" | "expired"> & { message: string | null; buyer_phone: string | null; note: string | null; payment_id: string | null }
type Data = { settings: Settings; online_payment: boolean; totals: { active: number; balance: number; sold: number }; cards: Row[] }

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—")
const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const KIND: Record<string, string> = { issue: "Выпуск", redeem_online: "Заказ на сайте", redeem_store: "Шоурум", refund: "Возврат", adjust: "Изменение" }

const post = async <T,>(url: string, body: unknown): Promise<T> => {
  const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (!r.ok) throw new Error(d.message ?? "Не получилось")
  return d
}

function StatusBadge({ r }: { r: Pick<Row, "status" | "balance"> & { expired?: boolean; expires_at?: string | null } }) {
  const expired = r.expired ?? Boolean(r.expires_at && new Date(r.expires_at).getTime() < Date.now())
  if (r.status === "pending") return <Badge size="2xsmall" color="grey">Ждёт оплаты</Badge>
  if (r.status === "disabled") return <Badge size="2xsmall" color="red">Отключена</Badge>
  if (expired) return <Badge size="2xsmall" color="grey">Истекла</Badge>
  if (r.balance <= 0) return <Badge size="2xsmall" color="grey">Потрачена</Badge>
  return <Badge size="2xsmall" color="green">Действует</Badge>
}

/** Карта: остаток, списание в шоуруме, возврат, срок, отключение, повторное письмо, журнал операций */
function CardDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [card, setCard] = useState<Card | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [expires, setExpires] = useState("")
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/admin/gift-cards/${id}`, { credentials: "include" })
    const d = (await r.json()) as { card: Card; transactions: Tx[] }
    setCard(d.card)
    setTxs(d.transactions)
    setExpires(d.card.expires_at ? d.card.expires_at.slice(0, 10) : "")
  }, [id])
  useEffect(() => { load().catch(() => toast.error("Не удалось загрузить карту")) }, [load])

  const act = async (action: string, extra: Record<string, unknown> = {}, ok = "Готово") => {
    setBusy(action)
    try {
      const d = await post<{ card: Card; transactions: Tx[] }>(`/admin/gift-cards/${id}`, { action, note, ...extra })
      setCard(d.card)
      setTxs(d.transactions)
      setAmount("")
      setNote("")
      toast.success(ok)
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const n = Number(amount.replace(/\D/g, ""))
  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose() }}>
      <Drawer.Content>
        <Drawer.Header><Drawer.Title>{card ? card.code : "Карта"}</Drawer.Title></Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          {!card ? <Text size="small">Загрузка…</Text> : (
            <>
              <div>
                <div className="flex items-center gap-2"><StatusBadge r={card} /><Text size="small" className="text-ui-fg-subtle">номинал {rub(card.amount)} · до {day(card.expires_at)}</Text></div>
                <Text className="mt-2 text-4xl">{rub(card.balance)}</Text>
                <Text size="small" className="text-ui-fg-subtle">остаток на карте</Text>
              </div>

              <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-4">
                <Label size="small" weight="plus">Списать или вернуть</Label>
                <div className="flex gap-2">
                  <Input size="small" inputMode="numeric" placeholder="Сумма, ₽" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
                  <Input size="small" placeholder="Комментарий: чек №, причина" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button size="small" disabled={!n || !!busy} isLoading={busy === "redeem"}
                    onClick={() => window.confirm(`Списать ${rub(n)} с карты ${card.code}?`) && act("redeem", { amount: n }, `Списано ${rub(n)}`)}>Списать (покупка в шоуруме)</Button>
                  <Button size="small" variant="secondary" disabled={!n || !!busy} isLoading={busy === "credit"}
                    onClick={() => window.confirm(`Вернуть ${rub(n)} на карту ${card.code}?`) && act("credit", { amount: n }, `Возвращено ${rub(n)}`)}>Вернуть на карту</Button>
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle">Покупатель в шоуруме называет код — найдите карту поиском, спишите сумму покупки. Остаток останется на карте.</Text>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><Text size="xsmall" className="text-ui-fg-subtle">Покупатель</Text><Text size="small">{card.buyer_name ?? "—"}</Text><Text size="small" className="text-ui-fg-subtle">{[card.buyer_email, card.buyer_phone].filter(Boolean).join(" · ") || "—"}</Text></div>
                <div><Text size="xsmall" className="text-ui-fg-subtle">Получатель</Text><Text size="small">{card.recipient_email ? card.recipient_name ?? "—" : "для себя"}</Text><Text size="small" className="text-ui-fg-subtle">{card.recipient_email ?? ""}</Text></div>
                <div><Text size="xsmall" className="text-ui-fg-subtle">Письмо с картой</Text><Text size="small">{card.sent_at ? `отправлено ${when(card.sent_at)}` : card.send_at ? `отправим ${day(card.send_at)}` : "не отправлялось"}</Text></div>
                <div><Text size="xsmall" className="text-ui-fg-subtle">Выпущена</Text><Text size="small">{card.source === "site" ? "куплена на сайте" : "в админке"} · {day(card.paid_at ?? card.created_at)}</Text></div>
                {card.message && <div className="col-span-2"><Text size="xsmall" className="text-ui-fg-subtle">Поздравление</Text><Text size="small" className="whitespace-pre-line">{card.message}</Text></div>}
              </div>

              <div className="flex flex-col gap-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Label size="small">Действует до</Label><Input size="small" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
                  <Button size="small" variant="secondary" disabled={!expires || !!busy} isLoading={busy === "extend"} onClick={() => act("extend", { expires_at: `${expires}T23:59:59+06:00` }, "Срок изменён")}>Изменить срок</Button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Label size="small">Отправить письмо с картой ещё раз</Label><Input size="small" type="email" placeholder={card.recipient_email ?? card.buyer_email ?? "email"} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <Button size="small" variant="secondary" disabled={card.status !== "active" || !!busy} isLoading={busy === "resend"} onClick={() => act("resend", { email }, "Письмо отправлено")}>Отправить</Button>
                </div>
                {card.status !== "pending" && (
                  <Button size="small" variant={card.status === "disabled" ? "secondary" : "danger"} className="w-fit" disabled={!!busy} isLoading={busy === "disable" || busy === "enable"}
                    onClick={() => card.status === "disabled" ? act("enable", {}, "Карта включена") : window.confirm("Отключить карту? Её нельзя будет использовать, пока не включите снова.") && act("disable", {}, "Карта отключена")}>
                    {card.status === "disabled" ? "Включить карту" : "Отключить карту"}
                  </Button>
                )}
              </div>

              <div>
                <Heading level="h3" className="mb-2">Операции</Heading>
                {!txs.length && <Text size="small" className="text-ui-fg-subtle">Пока нет</Text>}
                <div className="divide-y divide-ui-border-base">
                  {txs.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-3 py-2">
                      <div>
                        <Text size="small">{KIND[t.kind] ?? t.kind}{t.note ? ` · ${t.note}` : ""}</Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">{when(t.created_at)} · {t.created_by ?? ""}</Text>
                      </div>
                      {t.amount !== 0 && <Text size="small" className={t.amount < 0 ? "text-ui-fg-error" : "text-ui-fg-interactive"}>{t.amount > 0 ? "+" : "−"}{rub(Math.abs(t.amount))}</Text>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}

/** Выпустить карту вручную: продали в шоуруме или дарим клиенту */
function IssueDrawer({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [v, setV] = useState({ amount: "", email: "", name: "", message: "", note: "" })
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const d = await post<{ id: string; code: string }>("/admin/gift-cards", { ...v, amount: Number(v.amount) })
      toast.success(`Карта ${d.code} выпущена${v.email ? " — письмо отправлено" : ""}`)
      onDone(d.id)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose() }}>
      <Drawer.Content>
        <Drawer.Header><Drawer.Title>Выпустить карту</Drawer.Title></Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          <Text size="small" className="text-ui-fg-subtle">Карта сразу начнёт действовать. Укажите email — письмо с картой уйдёт сразу; без email код покажем здесь, его можно выдать вручную.</Text>
          <div><Label size="small">Номинал, ₽</Label><Input inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value.replace(/\D/g, "") })} /></div>
          <div><Label size="small">Email (необязательно)</Label><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
          <div><Label size="small">Имя (необязательно)</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
          <div><Label size="small">Поздравление (необязательно)</Label><Textarea rows={3} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} /></div>
          <div><Label size="small">Комментарий для себя: как оплачено</Label><Input placeholder="Оплачено в шоуруме наличными, чек №…" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button isLoading={busy} disabled={!Number(v.amount)} onClick={submit}>Выпустить</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/** Настройки продажи на сайте */
function SettingsBlock({ value, online, onSaved }: { value: Settings; online: boolean; onSaved: () => void }) {
  const [v, setV] = useState({ ...value, amountsText: value.amounts.join(", ") })
  const [busy, setBusy] = useState(false)
  useEffect(() => { setV({ ...value, amountsText: value.amounts.join(", ") }) }, [value])
  const save = async () => {
    setBusy(true)
    try {
      await post("/admin/gift-cards/settings", { enabled: v.enabled, amounts: v.amountsText.split(/[,;\s]+/).map((x) => Number(x.replace(/\D/g, ""))).filter(Boolean), min: Number(v.min), max: Number(v.max), validity_months: Number(v.validity_months) })
      toast.success("Сохранено")
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Container className="px-6 py-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 pb-1.5">
          <Switch id="gc-on" checked={v.enabled} onCheckedChange={(enabled) => setV({ ...v, enabled })} />
          <Label size="small" htmlFor="gc-on">{v.enabled ? "Продаются на сайте" : "Продажа на сайте выключена"}</Label>
        </div>
        <div className="w-72"><Label size="small">Готовые номиналы, ₽</Label><Input size="small" value={v.amountsText} onChange={(e) => setV({ ...v, amountsText: e.target.value })} /></div>
        <div className="w-28"><Label size="small">Своя сумма от</Label><Input size="small" inputMode="numeric" value={String(v.min)} onChange={(e) => setV({ ...v, min: Number(e.target.value.replace(/\D/g, "")) })} /></div>
        <div className="w-28"><Label size="small">до</Label><Input size="small" inputMode="numeric" value={String(v.max)} onChange={(e) => setV({ ...v, max: Number(e.target.value.replace(/\D/g, "")) })} /></div>
        <div className="w-28"><Label size="small">Срок, месяцев</Label><Input size="small" inputMode="numeric" value={String(v.validity_months)} onChange={(e) => setV({ ...v, validity_months: Number(e.target.value.replace(/\D/g, "")) })} /></div>
        <Button size="small" className="ml-auto" isLoading={busy} onClick={save}>Сохранить</Button>
      </div>
      {!online && <Text size="small" className="mt-2 text-ui-fg-error">Онлайн-оплата (Т-Касса) не настроена — купить карту на сайте нельзя.</Text>}
    </Container>
  )
}

/**
 * «Подарочные карты»: найти карту по коду или email, списать покупку в шоуруме, вернуть, продлить,
 * выпустить карту вручную; настройки продажи на сайте.
 */
const GiftCardsPage = () => {
  const [data, setData] = useState<Data | null>(null)
  // ?q=КОД — пришли по QR со страницы карты: сразу ищем её
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "")
  const [open, setOpen] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch("/admin/gift-cards", { credentials: "include" })
    if (!r.ok) throw new Error("Не удалось загрузить карты")
    setData((await r.json()) as Data)
  }, [])
  useEffect(() => { load().catch((e) => toast.error((e as Error).message)) }, [load])
  // Пришли по QR: одна найденная карта — сразу открываем
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("q")
    if (!code || !data || open) return
    const hit = data.cards.filter((r) => r.search.includes(code.toLowerCase().replace(/[^a-z0-9]/g, "")))
    if (hit.length === 1) setOpen(hit[0].id)
  }, [data])

  const list = useMemo(() => {
    const words = q.toLowerCase().replace(/[-–]/g, "").split(/\s+/).filter(Boolean)
    return (data?.cards ?? []).filter((r) => words.every((w) => r.search.includes(w)))
  }, [data, q])

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Heading level="h1">Подарочные карты</Heading>
            <Text size="small" className="text-ui-fg-subtle">Электронные карты: покупают на сайте, тратят частями на сайте и в шоуруме. Покупка в шоуруме — найдите карту по коду и спишите сумму.</Text>
          </div>
          <Button size="small" onClick={() => setIssuing(true)}>Выпустить карту</Button>
        </div>
        {data && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[["Действующих карт", String(data.totals.active)], ["Остаток на картах", rub(data.totals.balance)], ["Продано всего", rub(data.totals.sold)]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-ui-border-base px-4 py-3"><Text size="xsmall" className="text-ui-fg-subtle">{l}</Text><Text size="xlarge" weight="plus">{v}</Text></div>
            ))}
          </div>
        )}
      </Container>

      {data && <SettingsBlock value={data.settings} online={data.online_payment} onSaved={() => load()} />}

      <Container className="p-0">
        <div className="px-6 py-4">
          <Input type="search" placeholder="Код карты, email или имя" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-ui-border-base text-left text-ui-fg-subtle">
                <th className="px-6 py-2.5 font-medium">Код</th>
                <th className="py-2.5 pr-3 font-medium">Остаток</th>
                <th className="py-2.5 pr-3 font-medium">Статус</th>
                <th className="py-2.5 pr-3 font-medium">Покупатель → получатель</th>
                <th className="py-2.5 pr-6 font-medium">Куплена · до</th>
              </tr>
            </thead>
            <tbody>
              {!data && <tr><td colSpan={5} className="px-6 py-8 text-ui-fg-subtle">Загрузка…</td></tr>}
              {data && !list.length && <tr><td colSpan={5} className="px-6 py-8 text-ui-fg-subtle">{q ? "Ничего не найдено" : "Карт пока нет"}</td></tr>}
              {list.slice(0, 200).map((r) => (
                <tr key={r.id} className="cursor-pointer border-t border-ui-border-base hover:bg-ui-bg-base-hover" onClick={() => setOpen(r.id)}>
                  <td className="whitespace-nowrap px-6 py-2.5 font-mono">{r.code}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3">{rub(r.balance)} <span className="text-ui-fg-muted">из {rub(r.amount)}</span></td>
                  <td className="py-2.5 pr-3"><StatusBadge r={r} /></td>
                  <td className="max-w-[320px] truncate py-2.5 pr-3 text-ui-fg-subtle">{r.buyer_name ?? r.buyer_email ?? "—"}{r.recipient_email ? ` → ${r.recipient_name ?? r.recipient_email}` : ""}</td>
                  <td className="whitespace-nowrap py-2.5 pr-6 text-ui-fg-subtle">{day(r.paid_at ?? r.created_at)} · {day(r.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>

      {open && <CardDrawer id={open} onClose={() => setOpen(null)} onChanged={() => load()} />}
      {issuing && <IssueDrawer onClose={() => setIssuing(false)} onDone={(id) => { setIssuing(false); load(); setOpen(id) }} />}
    </div>
  )
}

export const config = defineRouteConfig({ label: "Подарочные карты", icon: Gift })

export default GiftCardsPage
