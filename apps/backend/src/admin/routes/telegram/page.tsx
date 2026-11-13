import { defineRouteConfig } from "@medusajs/admin-sdk"
import { PaperPlane } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, Heading, Input, Select, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

type Post = { id: number; at: string }
type Row = {
  id: string; handle: string; title: string; thumbnail: string | null; brand: string | null; category: string | null
  price: number; compare_at: number | null; in_stock: boolean; preorder: boolean
  sizes_in_stock: number; sizes_total: number; images: number; has_description: boolean; sales: number; is_new: boolean
  posts: Post[]; link: string | null; recommendation: { score: number; reasons: string[] } | null
}
type Overview = {
  configured: { channel: string | null; token: boolean }
  totals: { products: number; posted: number; never: number; posts: number; last7: number; last30: number }
  rows: Row[]
  queue: number
}

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

/**
 * «Telegram»: посты о товарах в канале магазина. Сколько раз и когда выкладывали каждый товар,
 * какие ещё ни разу, и подсказки, что выложить сейчас (новинки, сезон, скидки, давно не было).
 */
const TelegramPage = () => {
  const [data, setData] = useState<Overview | null>(null)
  const [view, setView] = useState("rec")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch("/admin/telegram", { credentials: "include" })
    if (!r.ok) throw new Error("Не удалось загрузить данные")
    setData((await r.json()) as Overview)
  }, [])
  useEffect(() => { load().catch((e) => toast.error((e as Error).message)) }, [load])
  useEffect(() => { setPage(0) }, [view, q])

  const list = useMemo(() => {
    if (!data) return []
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const rows = data.rows.filter((r) => !words.length || words.every((w) => `${r.title} ${r.brand ?? ""}`.toLowerCase().includes(w)))
    if (view === "rec") return rows.filter((r) => r.recommendation).sort((a, b) => b.recommendation!.score - a.recommendation!.score)
    if (view === "never") return rows.filter((r) => !r.posts.length).sort((a, b) => (b.recommendation?.score ?? -999) - (a.recommendation?.score ?? -999))
    if (view === "posted") return rows.filter((r) => r.posts.length).sort((a, b) => lastAt(b).localeCompare(lastAt(a)))
    return rows
  }, [data, view, q])
  const shown = list.slice(page * PAGE, (page + 1) * PAGE)

  const publish = async (ids: string[]) => {
    if (!ids.length) return
    const many = ids.length > 1
    if (!window.confirm(many ? `Выложить ${ids.length} товаров в канал? Посты пойдут по одному раз в 30 секунд.` : "Выложить товар в канал?")) return
    setBusy(many ? "bulk" : ids[0])
    try {
      const r = await fetch("/admin/telegram/publish", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      })
      const d = (await r.json().catch(() => ({}))) as { message?: string; link?: string | null; queued?: number; minutes?: number }
      if (!r.ok) throw new Error(d.message ?? "Не получилось")
      if (many) {
        toast.success(`В очереди: ${d.queued}. Займёт около ${d.minutes} мин — обновите страницу позже`)
        setSelected(new Set())
      } else {
        toast.success("Выложено в канал")
        if (d.link) window.open(d.link, "_blank", "noopener")
        await load()
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const t = data?.totals
  const notReady = data && (!data.configured.channel || !data.configured.token)

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="px-6 py-4">
        <Heading level="h1">Telegram</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Посты о товарах в канале{data?.configured.channel ? ` ${data.configured.channel}` : ""}: альбом с фото, цена, размеры в наличии, описание и ссылка на сайт.
          Когда меняется цена или продаётся размер, подпись в уже выложенном посте обновляется сама (раз в 10 минут).
        </Text>
        {notReady && (
          <Text size="small" className="mt-2 text-ui-fg-error">
            Канал не настроен: на сервере нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID, а бот — администратор канала.
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
        {data && data.queue > 0 && <Text size="small" className="mt-3">В очереди на публикацию: {data.queue}</Text>}
      </Container>

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
              <Button size="small" variant="transparent" onClick={() => setSelected(new Set(list.slice(0, 5).map((r) => r.id)))}>Выбрать 5 лучших</Button>
            )}
            {selected.size > 0 && <Button size="small" variant="transparent" onClick={() => setSelected(new Set())}>Снять выбор</Button>}
            <Button size="small" disabled={!selected.size || !!busy || !!notReady} isLoading={busy === "bulk"} onClick={() => publish([...selected])}>
              Выложить выбранные
            </Button>
          </div>
        </div>
        {view === "rec" && (
          <Text size="small" className="px-6 pb-3 text-ui-fg-subtle">
            Выше — то, что полезнее выложить сейчас: ещё не выкладывали или давно, новинки, вещи по сезону, скидки, хорошо продаётся, остались последние размеры.
            Не предлагаем: нет в наличии, меньше 2 фото, выкладывали в последние 2 недели. Бренды, которые уже были в последние 3 дня, — ниже.
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
                    {rub(r.price)}
                    {r.compare_at && <span className="ml-1.5 text-xs text-ui-fg-muted line-through">{rub(r.compare_at)}</span>}
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
                  <td className="py-2 pr-6 text-right">
                    <Button size="small" variant="secondary" disabled={!!busy || !!notReady} isLoading={busy === r.id} onClick={() => publish([r.id])}>
                      {r.posts.length ? "Ещё раз" : "Выложить"}
                    </Button>
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

export const config = defineRouteConfig({ label: "Telegram", icon: PaperPlane })

export default TelegramPage
