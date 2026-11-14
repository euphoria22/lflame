import { defineRouteConfig } from "@medusajs/admin-sdk"
import { PaperPlane } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, Heading, IconButton, Input, Label, Select, Switch, Text, toast } from "@medusajs/ui"
import { ArrowUpMini, ArrowDownMini, XMarkMini } from "@medusajs/icons"
import { useCallback, useEffect, useMemo, useState } from "react"

type Post = { id: number; at: string }
type Row = {
  id: string; handle: string; title: string; thumbnail: string | null; brand: string | null; category: string | null
  price: number; compare_at: number | null; promo: { price: number; label: string; pct: number } | null; in_stock: boolean; preorder: boolean
  sizes_in_stock: number; sizes_total: number; images: number; has_description: boolean; sales: number; is_new: boolean
  posts: Post[]; link: string | null; recommendation: { score: number; reasons: string[]; order?: number } | null
}
type Overview = {
  configured: { channel: string | null; token: boolean }
  totals: { products: number; posted: number; never: number; posts: number; last7: number; last30: number }
  rows: Row[]
  queue: {
    schedule: Schedule; items: string[]; last_at: string | null; last_error: string | null; slots: string[]
    /** ВКонтакте: отложенные записи и на сколько дней вперёд заполнять */
    planned?: { product_id: string; post_id: number; at: string; auto: boolean; link: string | null }[]
    horizon_days?: number
  }
}
type Schedule = { start: string; end: string; every: number; tz: string; auto: boolean; enabled: boolean }

const VIEWS: Record<string, string> = {
  rec: "Рекомендуем выложить",
  never: "Ещё не выкладывали",
  posted: "Уже выкладывали",
  all: "Все товары на сайте",
}
const PAGE = 50
const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`
const date = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "2-digit" })
const lastAt = (r: Row) => (r.posts.length ? r.posts[r.posts.length - 1].at : "")
const slot = (iso: string, tz: string) => new Date(iso).toLocaleString("ru-RU", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

/** Расписание: с — до (время магазина), интервал, рекомендации при пустой очереди, пауза */
const ScheduleBlock = ({ value, onSaved, net, horizon }: { value: Schedule; onSaved: () => Promise<void>; net: Net; horizon?: number }) => {
  const [v, setV] = useState(value)
  const [days, setDays] = useState(horizon ?? 7)
  useEffect(() => { setDays(horizon ?? 7) }, [horizon])
  const [saving, setSaving] = useState(false)
  useEffect(() => { setV(value) }, [value])
  const changed = JSON.stringify(v) !== JSON.stringify(value) || (net === "vk" && days !== (horizon ?? 7))
  const perDay = (() => {
    const m = (x: string) => { const [h, mm] = x.split(":").map(Number); return h * 60 + mm }
    return v.every > 0 && m(v.end) >= m(v.start) ? Math.floor((m(v.end) - m(v.start)) / v.every) + 1 : 0
  })()
  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch("/admin/telegram/schedule", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...v, net, ...(net === "vk" ? { horizon_days: days } : {}) }) })
      const d = (await r.json().catch(() => ({}))) as { message?: string }
      if (!r.ok) throw new Error(d.message ?? "Не сохранилось")
      toast.success("Расписание сохранено")
      await onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Container className="px-6 py-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Heading level="h2">Расписание</Heading>
          <Text size="small" className="text-ui-fg-subtle">Время — {v.tz === "Asia/Omsk" ? "омское" : v.tz}. В день: {perDay} постов</Text>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">С</Label>
          <Input size="small" type="time" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} className="w-28" />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">До</Label>
          <Input size="small" type="time" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} className="w-28" />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Раз в, минут</Label>
          <Input size="small" type="number" min={5} step={5} value={String(v.every)} onChange={(e) => setV({ ...v, every: Number(e.target.value) })} className="w-24" />
        </div>
        {net === "vk" && (
          <div className="flex flex-col gap-1">
            <Label size="small">Отложка вперёд, дней</Label>
            <Input size="small" type="number" min={1} max={14} value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-24" />
          </div>
        )}
        <div className="flex items-center gap-2 pb-1.5">
          <Switch id="tg-auto" checked={v.auto} onCheckedChange={(auto) => setV({ ...v, auto })} />
          <Label size="small" htmlFor="tg-auto">{net === "vk" ? "Заполнять свободные слоты рекомендациями" : "Очередь пуста — выкладывать рекомендации"}</Label>
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <Switch id="tg-on" checked={v.enabled} onCheckedChange={(enabled) => setV({ ...v, enabled })} />
          <Label size="small" htmlFor="tg-on">{v.enabled ? "Посты выходят" : "Пауза"}</Label>
        </div>
        <Button size="small" className="ml-auto" disabled={!changed} isLoading={saving} onClick={save}>Сохранить</Button>
      </div>
    </Container>
  )
}

/** ВКонтакте: отложенные записи на неделю — время, товар, из рекомендаций или вручную; «Убрать» освобождает слот для следующего товара */
const PlannedBlock = ({ data, byId, busy, onRemove, onSync }: { data: Overview; byId: Map<string, Row>; busy: string | null; onRemove: (postId: number) => void; onSync: () => void }) => {
  const planned = data.queue.planned ?? []
  const tz = data.queue.schedule.tz
  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Отложенные записи · {planned.length}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Посты уже лежат в «Отложенных записях» сообщества и выйдут сами — их видно и можно поправить прямо во ВКонтакте.
            До выхода сайт заменит проданный товар и обновит цену; вышедшие посты больше не меняются. Отложка пополняется раз в 10 минут.
          </Text>
          {data.queue.last_error && <Text size="small" className="text-ui-fg-error">Последняя ошибка: {data.queue.last_error}</Text>}
        </div>
        <Button size="small" variant="secondary" isLoading={busy === "planned"} disabled={!!busy} onClick={onSync}>Обновить сейчас</Button>
      </div>
      {!planned.length && <Text size="small" className="border-t border-ui-border-base px-6 py-3 text-ui-fg-subtle">Пока пусто: добавьте товары в очередь или включите заполнение рекомендациями.</Text>}
      {planned.map((p) => {
        const r = byId.get(p.product_id)
        return (
          <div key={p.post_id} className="flex items-center gap-3 border-t border-ui-border-base px-6 py-2">
            <Text size="small" className="w-36 shrink-0 text-ui-fg-subtle">{slot(p.at, tz)}</Text>
            <span className="h-10 w-8 shrink-0 overflow-hidden rounded bg-ui-bg-component">
              {r?.thumbnail && <img src={r.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </span>
            <a href={`/app/products/${p.product_id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{r?.title ?? "Товар снят с сайта — запись будет удалена"}</a>
            <Badge size="2xsmall" color={p.auto ? "grey" : "blue"}>{p.auto ? "рекомендация" : "вручную"}</Badge>
            {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-ui-fg-interactive txt-small hover:underline">Во ВКонтакте</a>}
            <Button size="small" variant="transparent" disabled={!!busy} onClick={() => window.confirm("Убрать запись из отложки? Слот займёт следующий товар, этот не будет предлагаться 14 дней.") && onRemove(p.post_id)}>Убрать</Button>
          </div>
        )
      })}
    </Container>
  )
}

/**
 * «Соцсети»: посты о товарах в Telegram-канале и сообществе ВКонтакте. Сколько раз и когда выкладывали каждый товар,
 * какие ещё ни разу, и подсказки, что выложить сейчас (новинки, сезон, скидки, давно не было).
 */
type Net = "tg" | "vk"
const NET_NAME: Record<Net, string> = { tg: "Telegram", vk: "ВКонтакте" }
const NET_KEY = "lf-social-net"

const TelegramPage = () => {
  const [net, setNetState] = useState<Net>(() => {
    try { return localStorage.getItem(NET_KEY) === "vk" ? "vk" : "tg" } catch { return "tg" }
  })
  const setNet = (n: Net) => { setNetState(n); setData(null); setSelected(new Set()); try { localStorage.setItem(NET_KEY, n) } catch { /* не важно */ } }
  const [data, setData] = useState<Overview | null>(null)
  const [view, setView] = useState("rec")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/admin/telegram?net=${net}`, { credentials: "include" })
    if (!r.ok) throw new Error("Не удалось загрузить данные")
    setData((await r.json()) as Overview)
  }, [net])
  useEffect(() => { load().catch((e) => toast.error((e as Error).message)) }, [load])
  useEffect(() => { setPage(0) }, [view, q])

  const list = useMemo(() => {
    if (!data) return []
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const rows = data.rows.filter((r) => !words.length || words.every((w) => `${r.title} ${r.brand ?? ""}`.toLowerCase().includes(w)))
    // Порядок с сервера: по баллу, но бренды и разделы вперемешку
    if (view === "rec") return rows.filter((r) => r.recommendation).sort((a, b) => (a.recommendation!.order ?? 1e9) - (b.recommendation!.order ?? 1e9))
    if (view === "never") return rows.filter((r) => !r.posts.length).sort((a, b) => (b.recommendation?.score ?? -999) - (a.recommendation?.score ?? -999))
    if (view === "posted") return rows.filter((r) => r.posts.length).sort((a, b) => lastAt(b).localeCompare(lastAt(a)))
    return rows
  }, [data, view, q])
  const shown = list.slice(page * PAGE, (page + 1) * PAGE)

  const call = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(body as object), net }) })
    const d = (await r.json().catch(() => ({}))) as { message?: string; link?: string | null }
    if (!r.ok) throw new Error(d.message ?? "Не получилось")
    return d
  }
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn(); await load() } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }

  /** Сразу, вне расписания */
  const publishNow = (id: string) => {
    if (!window.confirm(`Выложить товар в ${net === "vk" ? "сообщество ВКонтакте" : "Telegram-канал"} прямо сейчас, вне расписания?`)) return
    run(id, async () => {
      const d = await call("/admin/telegram/publish", { id })
      toast.success(net === "vk" ? "Выложено во ВКонтакте" : "Выложено в канал")
      if (d.link) window.open(d.link, "_blank", "noopener")
    })
  }
  const queueAdd = (ids: string[]) => run(ids.length > 1 ? "bulk" : `q-${ids[0]}`, async () => {
    await call("/admin/telegram/queue", { add: ids })
    toast.success(ids.length > 1 ? `Добавлено в очередь: ${ids.length}` : "Добавлено в очередь")
    setSelected(new Set())
  })
  const queueEdit = (body: unknown) => run("queue", async () => { await call("/admin/telegram/queue", body) })

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const t = data?.totals
  const queued = new Set(data?.queue.items ?? [])
  const byId = useMemo(() => new Map((data?.rows ?? []).map((r) => [r.id, r])), [data])
  const notReady = data && (!data.configured.channel || !data.configured.token)

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading level="h1">Соцсети</Heading>
          <div className="flex gap-1 rounded-lg bg-ui-bg-subtle p-1">
            {(["tg", "vk"] as Net[]).map((n) => (
              <Button key={n} size="small" variant={net === n ? "primary" : "transparent"} onClick={() => net !== n && setNet(n)}>{NET_NAME[n]}</Button>
            ))}
          </div>
        </div>
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          {net === "vk"
            ? <>Посты о товарах в сообществе ВКонтакте{data?.configured.channel ? ` ${data.configured.channel}` : ""}: фото, цена, размеры в наличии, описание и ссылка на сайт (без жирного шрифта — ВКонтакте его не поддерживает).</>
            : <>Посты о товарах в канале{data?.configured.channel ? ` ${data.configured.channel}` : ""}: альбом с фото, цена, размеры в наличии, описание и ссылка на сайт.</>}
          {" "}У каждой соцсети своя очередь, расписание и история. Когда меняется цена или продаётся размер, текст в уже выложенном посте обновляется сам (раз в 10 минут).
        </Text>
        {notReady && (
          <Text size="small" className="mt-2 text-ui-fg-error">
            {net === "vk"
              ? "ВКонтакте не настроен: на сервере нужны VK_GROUP_ID (номер сообщества) и VK_ACCESS_TOKEN (ключ владельца сообщества)."
              : "Канал не настроен: на сервере нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID, а бот — администратор канала."}
          </Text>
        )}
        {t && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Товаров на сайте", t.products],
              ["Выкладывали", t.posted],
              ["Ни разу", t.never],
              ["Постов за 7 дней", t.last7],
              ["Постов за 30 дней", t.last30],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-ui-border-base px-4 py-3">
                <Text size="xsmall" className="text-ui-fg-subtle">{label}</Text>
                <Text size="xlarge" weight="plus">{value}</Text>
              </div>
            ))}
          </div>
        )}
      </Container>

      {data && <ScheduleBlock value={data.queue.schedule} onSaved={load} net={net} horizon={data.queue.horizon_days} />}

      {data && net === "vk" && <PlannedBlock data={data} byId={byId} busy={busy} onRemove={(postId) => run("planned", async () => { await call("/admin/telegram/planned", { remove: postId }) })} onSync={() => run("planned", async () => { await call("/admin/telegram/planned", { sync: true }); toast.success("Отложка обновлена") })} />}

      {data && (net === "tg" || data.queue.items.length > 0) && (
        <Container className="p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <Heading level="h2">{net === "vk" ? "Ждут отложки" : "Очередь"} · {data.queue.items.length}</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                {net === "vk" ? "Уйдут в отложенные записи на ближайшие свободные слоты в течение 10 минут"
                  : data.queue.items.length
                  ? `Следующий пост: ${slot(data.queue.slots[0], data.queue.schedule.tz)}`
                  : data.queue.schedule.auto ? "Очередь пуста — в каждый слот выйдет лучшая рекомендация" : "Очередь пуста — добавьте товары из списка ниже"}
                {data.queue.last_at ? ` · последний пост по расписанию: ${slot(data.queue.last_at, data.queue.schedule.tz)}` : ""}
              </Text>
              {data.queue.last_error && <Text size="small" className="text-ui-fg-error">Последняя ошибка: {data.queue.last_error}</Text>}
            </div>
            {data.queue.items.length > 0 && (
              <Button size="small" variant="transparent" disabled={!!busy} onClick={() => window.confirm("Очистить очередь?") && queueEdit({ clear: true })}>Очистить</Button>
            )}
          </div>
          {data.queue.items.map((id, i) => {
            const r = byId.get(id)
            return (
              <div key={id} className="flex items-center gap-3 border-t border-ui-border-base px-6 py-2">
                <Text size="small" className="w-36 shrink-0 text-ui-fg-subtle">{net === "tg" && data.queue.slots[i] ? slot(data.queue.slots[i], data.queue.schedule.tz) : ""}</Text>
                <span className="h-10 w-8 shrink-0 overflow-hidden rounded bg-ui-bg-component">
                  {r?.thumbnail && <img src={r.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </span>
                <a href={`/app/products/${id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{r?.title ?? "Товар снят с сайта — будет пропущен"}</a>
                <div className="flex shrink-0 gap-1">
                  <IconButton size="small" variant="transparent" disabled={i === 0 || !!busy} onClick={() => queueEdit({ move: { id, to: "up" } })}><ArrowUpMini /></IconButton>
                  <IconButton size="small" variant="transparent" disabled={i === data.queue.items.length - 1 || !!busy} onClick={() => queueEdit({ move: { id, to: "down" } })}><ArrowDownMini /></IconButton>
                  <IconButton size="small" variant="transparent" disabled={!!busy} onClick={() => queueEdit({ remove: [id] })}><XMarkMini /></IconButton>
                </div>
              </div>
            )
          })}
        </Container>
      )}

      <Container className="p-0">
        <div className="flex flex-wrap items-center gap-2 px-6 py-4">
          <div className="w-56">
            <Select size="small" value={view} onValueChange={setView}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>{Object.entries(VIEWS).map(([k, l]) => <Select.Item key={k} value={k}>{l}</Select.Item>)}</Select.Content>
            </Select>
          </div>
          <div className="w-64"><Input size="small" type="search" placeholder="Название, бренд" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Text size="small" className="text-ui-fg-subtle">Найдено: {list.length}{selected.size ? ` · выбрано: ${selected.size}` : ""}</Text>
          <div className="ml-auto flex gap-2">
            {view === "rec" && list.length > 0 && (
              <Button size="small" variant="transparent" onClick={() => setSelected(new Set(list.filter((r) => !queued.has(r.id)).slice(0, 10).map((r) => r.id)))}>Выбрать 10 лучших</Button>
            )}
            {selected.size > 0 && <Button size="small" variant="transparent" onClick={() => setSelected(new Set())}>Снять выбор</Button>}
            <Button size="small" disabled={!selected.size || !!busy} isLoading={busy === "bulk"} onClick={() => queueAdd([...selected])}>
              В очередь выбранные
            </Button>
          </div>
        </div>
        {view === "rec" && (
          <Text size="small" className="px-6 pb-3 text-ui-fg-subtle">
            Сверху — что выложить следующим. Основа — балл товара из умной сортировки каталога (новизна, продажи, интерес, размеры, сезон, маржа, ручные правила).
            К нему добавляются большой остаток, спрос раздела и давность поста. Порядок вперемешку: бренды, разделы и цвета одной модели не идут подряд.
            Не предлагаем: нет в наличии, нет фото, недавно выкладывали. Веса и интервалы — в разделе «Сортировка» → «Настройки» → «Рекомендации постов в Telegram» (общие для обеих соцсетей).
          </Text>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-ui-border-base text-left text-ui-fg-subtle">
                <th className="w-10 px-6 py-2.5" />
                <th className="py-2.5 pr-3 font-medium">Товар</th>
                <th className="py-2.5 pr-3 font-medium">Цена</th>
                <th className="py-2.5 pr-3 font-medium">Постов</th>
                <th className="py-2.5 pr-3 font-medium">{view === "rec" ? "Почему" : "Последний пост"}</th>
                <th className="py-2.5 pr-6" />
              </tr>
            </thead>
            <tbody>
              {!data && <tr><td colSpan={6} className="px-6 py-8 text-ui-fg-subtle">Загрузка…</td></tr>}
              {data && !shown.length && <tr><td colSpan={6} className="px-6 py-8 text-ui-fg-subtle">Ничего не найдено</td></tr>}
              {shown.map((r) => (
                <tr key={r.id} className={`border-t border-ui-border-base hover:bg-ui-bg-base-hover ${selected.has(r.id) ? "bg-ui-bg-highlight" : ""}`}>
                  <td className="px-6 py-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                  <td className="max-w-[380px] py-2 pr-3">
                    <a href={`/app/products/${r.id}`} className="flex items-center gap-3 text-ui-fg-base hover:underline">
                      <span className="h-10 w-8 shrink-0 overflow-hidden rounded bg-ui-bg-component">
                        {r.thumbnail && <img src={r.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{r.title}</span>
                        <span className="block text-xs text-ui-fg-subtle">
                          {[r.brand, r.category, r.in_stock ? `размеров: ${r.sizes_in_stock} из ${r.sizes_total}` : r.preorder ? "предзаказ" : "нет в наличии", `фото: ${r.images}`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </a>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3">
                    {rub(r.promo?.price ?? r.price)}
                    {(r.compare_at || r.promo) && <span className="ml-1.5 text-xs text-ui-fg-muted line-through">{rub(r.compare_at ?? r.price)}</span>}
                    {r.promo && <span className="block text-xs text-ui-fg-subtle">«{r.promo.label}» −{r.promo.pct}%</span>}
                  </td>
                  <td className="py-2 pr-3">{r.posts.length ? <Badge size="2xsmall" color="blue">{r.posts.length}</Badge> : <Badge size="2xsmall" color="grey">0</Badge>}</td>
                  <td className="max-w-[320px] py-2 pr-3 text-ui-fg-subtle">
                    {view === "rec" && r.recommendation ? (
                      <div className="flex flex-wrap gap-1">{r.recommendation.reasons.map((x) => <Badge key={x} size="2xsmall">{x}</Badge>)}</div>
                    ) : r.posts.length ? (
                      <span>
                        {date(lastAt(r))}
                        {r.link && <> · <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-ui-fg-interactive hover:underline">открыть</a></>}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2 pr-6">
                    <div className="flex justify-end gap-1">
                      {queued.has(r.id)
                        ? <Badge size="small" color="orange">в очереди</Badge>
                        : <Button size="small" variant="secondary" disabled={!!busy} isLoading={busy === `q-${r.id}`} onClick={() => queueAdd([r.id])}>В очередь</Button>}
                      <Button size="small" variant="transparent" disabled={!!busy || !!notReady} isLoading={busy === r.id} onClick={() => publishNow(r.id)}>Сейчас</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {list.length > PAGE && (
          <div className="flex items-center justify-between border-t border-ui-border-base px-6 py-3">
            <Text size="small" className="text-ui-fg-subtle">{page * PAGE + 1}–{Math.min((page + 1) * PAGE, list.length)} из {list.length}</Text>
            <div className="flex gap-2">
              <Button size="small" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Назад</Button>
              <Button size="small" variant="secondary" disabled={(page + 1) * PAGE >= list.length} onClick={() => setPage((p) => p + 1)}>Вперёд</Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Соцсети", icon: PaperPlane })

export default TelegramPage
