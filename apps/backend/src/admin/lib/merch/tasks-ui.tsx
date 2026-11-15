import { Badge, Button, Container, Heading, Input, Text, Textarea, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { Assign, capacityOf, Slot } from "../../../lib/merch/autofill"
import { Item, LayoutData, typeOf } from "./catalog"
import type { MerchScene } from "./scene"

type TaskInfo = { id: string; name: string; status: "open" | "done" | "closed"; created_at: string; url: string; total: number; done: number; photos: number; redo: number }
type StepP = { id: string; title: string; brand: string | null; thumb: string | null; sizes: string[]; n: number; place: string }
type Step = { id: string; title: string; where: string; render: string | null; products: StepP[]; remove: StepP[]; text: string[]; done_at: string | null; done_by: string | null; photos: string[]; comment: string | null; review: "ok" | "redo" | null }
type TaskFull = { id: string; name: string; status: string; note: string | null; url: string; steps: Step[] }

const api = async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
  const r = await fetch(`/admin/merch${path}`, { method, credentials: "include", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message ?? `Ошибка (ответ сервера ${r.status})`)
  return d as T
}

/** Где стоит оборудование — простыми словами для консультанта */
export function whereOf(it: Item, data: LayoutData): string {
  const { width: W, length: L } = data.room
  const zone = data.zones.find((z) => it.x >= z.x && it.x <= z.x + z.w && it.y >= z.y && it.y <= z.y + z.d)
  const near = [
    { d: it.y, t: "у верхней стены (на плане)" }, { d: L - it.y, t: "у нижней стены (на плане)" },
    { d: it.x, t: "у левой стены (на плане)" }, { d: W - it.x, t: "у правой стены (на плане)" },
  ].sort((a, b) => a.d - b.d)[0]
  const parts = [zone ? `зона «${zone.name}»` : null, near.d < 0.8 ? near.t : "в зале", `${num(it.x)} м от левой стены, ${num(it.y)} м от верхней`]
  return parts.filter(Boolean).join(" · ")
}
const num = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")

/** Название шага: подпись или тип + номер слева направо */
export function titleOf(it: Item, data: LayoutData): string {
  if (it.label) return it.label
  const same = data.items.filter((x) => x.type === it.type).sort((a, b) => a.y - b.y || a.x - b.x)
  const i = same.findIndex((x) => x.id === it.id)
  return same.length > 1 ? `${typeOf(it.type).name} №${i + 1}` : typeOf(it.type).name
}

const sameSlots = (a: Slot[] = [], b: Slot[] = []) => JSON.stringify(a.map((s) => [s.p, s.n])) === JSON.stringify(b.map((s) => [s.p, s.n]))

export function TasksBlock({ layoutId, layoutName, isCurrent, data, dirty, sceneRef, ensure3d }: {
  layoutId: string; layoutName: string; isCurrent: boolean; data: LayoutData; dirty: boolean
  sceneRef: React.MutableRefObject<MerchScene | null>
  /** Включить 3D-вид (для картинок к шагам) — вернёт, когда сцена готова */
  ensure3d: () => Promise<boolean>
}) {
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [form, setForm] = useState<{ name: string; note: string; onlyChanges: boolean; renders: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<TaskFull | null>(null)
  const load = useCallback(() => { api<{ tasks: TaskInfo[] }>("/tasks").then((d) => setTasks(d.tasks)).catch((e: Error) => toast.error(e.message)) }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form) return
    if (dirty) { toast.error("Сначала сохраните расстановку"); return }
    setBusy("create")
    try {
      // С чем сравниваем: текущая расстановка магазина (если открыт другой вариант)
      let base: Assign | null = null
      if (form.onlyChanges && !isCurrent) {
        const list = await api<{ layouts: { id: string; is_current: boolean }[] }>("/layouts")
        const cur = list.layouts.find((l) => l.is_current)
        if (cur) base = ((await api<{ layout: { data: LayoutData } }>(`/layouts/${cur.id}`)).layout.data.assign ?? {})
      }
      const assign = data.assign ?? {}
      const items = data.items.filter((it) => {
        const c = capacityOf(it)
        if (!c.rail && !c.shelf) return false
        if (base) return !sameSlots(assign[it.id], base[it.id])
        return (assign[it.id]?.length ?? 0) > 0
      })
      if (!items.length) throw new Error(base ? "Отличий от текущей расстановки нет" : "На оборудовании нет товаров — сначала разложите товары")
      const has3d = form.renders ? await ensure3d() : false
      const steps = []
      for (const it of items) {
        let render: string | null = null
        if (has3d && sceneRef.current) {
          const shot = sceneRef.current.shot(it.id)
          if (shot) render = (await api<{ url: string }>("/upload", "POST", { data: shot, name: `step-${it.type}` })).url
        }
        const now = assign[it.id] ?? []
        const before = base?.[it.id] ?? []
        steps.push({
          item_id: it.id, type: it.type, title: titleOf(it, data), where: whereOf(it, data), render,
          products: now, remove: before.filter((s) => !now.some((x) => x.p === s.p)).map((s) => s.p),
        })
      }
      // Порядок обхода: от входа вглубь — по сторонам зала
      const t = await api<{ task: { id: string; url: string } }>("/tasks", "POST", { layout_id: layoutId, name: form.name, note: form.note || null, steps })
      await navigator.clipboard?.writeText(t.task.url).catch(() => undefined)
      toast.success("Задание создано, ссылка скопирована")
      setForm(null)
      load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }

  const send = async (id: string) => {
    setBusy(`send${id}`)
    await api(`/tasks/${id}/send`, "POST", {}).then(() => toast.success("Ссылка отправлена в рабочий чат")).catch((e: Error) => toast.error(e.message))
    setBusy(null)
  }
  const openTask = async (id: string) => {
    if (open?.id === id) { setOpen(null); return }
    const d = await api<{ task: TaskFull }>(`/tasks/${id}`).catch((e: Error) => { toast.error(e.message); return null })
    if (d) setOpen(d.task)
  }
  const review = async (patch: Record<string, unknown>) => {
    if (!open) return
    const d = await api<{ task: TaskFull }>(`/tasks/${open.id}`, "POST", patch).catch((e: Error) => { toast.error(e.message); return null })
    if (d) { setOpen(d.task); load() }
  }
  const remove = async (id: string) => {
    if (!window.confirm("Удалить задание? Ссылка у консультантов перестанет работать.")) return
    await api(`/tasks/${id}`, "DELETE").then(() => { if (open?.id === id) setOpen(null); load() }).catch((e: Error) => toast.error(e.message))
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h2">Задания консультантам</Heading>
          <Text size="small" className="text-ui-fg-subtle">Задание собирается из этого варианта: по каждому оборудованию — картинка из 3D, что и в каком порядке повесить, что убрать. Консультант открывает ссылку на телефоне, отмечает сделанное и прикладывает фото.</Text>
        </div>
        {!form && <Button size="small" onClick={() => setForm({ name: `${layoutName} — выкладка ${new Date().toLocaleDateString("ru-RU")}`, note: "", onlyChanges: !isCurrent, renders: true })}>Создать задание</Button>}
      </div>
      {form && (
        <div className="flex flex-col gap-3 px-6 py-4">
          <Input size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Название задания" />
          <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Общий комментарий для консультантов (необязательно): например, «Сначала отпарить новую поставку C.P. Company»" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.onlyChanges} disabled={isCurrent} onChange={(e) => setForm({ ...form, onlyChanges: e.target.checked })} />
            Только изменения относительно текущей расстановки магазина {isCurrent && <span className="text-ui-fg-subtle">(открыт текущий вариант — войдёт всё оборудование с товарами)</span>}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.renders} onChange={(e) => setForm({ ...form, renders: e.target.checked })} />
            Добавить к каждому шагу картинку из 3D
          </label>
          <div className="flex gap-2">
            <Button size="small" isLoading={busy === "create"} onClick={create}>Создать и скопировать ссылку</Button>
            <Button size="small" variant="secondary" onClick={() => setForm(null)}>Отмена</Button>
          </div>
        </div>
      )}
      {tasks.length === 0 && !form && <Text size="small" className="px-6 py-4 text-ui-fg-subtle">Заданий пока нет.</Text>}
      {tasks.map((t) => (
        <div key={t.id} className="flex flex-col">
          <div className="flex flex-wrap items-center gap-3 px-6 py-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openTask(t.id)}>
              <Text size="small" weight="plus" className="truncate">{t.name}</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">{new Date(t.created_at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · сделано {t.done} из {t.total} · фото {t.photos}</Text>
            </button>
            {t.status === "closed" ? <Badge size="2xsmall" color="grey">закрыто</Badge> : t.status === "done" ? <Badge size="2xsmall" color="green">выполнено</Badge> : <Badge size="2xsmall" color="orange">в работе</Badge>}
            {t.redo > 0 && <Badge size="2xsmall" color="red">переделать: {t.redo}</Badge>}
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ui-bg-subtle"><div className="h-full bg-ui-tag-green-icon" style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%` }} /></div>
            <Button size="small" variant="transparent" onClick={() => { navigator.clipboard?.writeText(t.url); toast.success("Ссылка скопирована") }}>Ссылка</Button>
            <Button size="small" variant="transparent" isLoading={busy === `send${t.id}`} onClick={() => send(t.id)}>В рабочий чат</Button>
            <a href={t.url} target="_blank" rel="noreferrer" className="text-sm text-ui-fg-interactive">Открыть как консультант</a>
            <Button size="small" variant="transparent" onClick={() => remove(t.id)}>Удалить</Button>
          </div>
          {open?.id === t.id && (
            <div className="flex flex-col gap-3 bg-ui-bg-subtle px-6 py-4">
              {open.steps.map((s, i) => <ReviewStep key={s.id} n={i + 1} s={s} onPatch={(p) => review({ steps: [{ id: s.id, ...p }] })} />)}
              <div className="flex gap-2">
                {open.status !== "closed"
                  ? <Button size="small" variant="secondary" onClick={() => review({ status: "closed" })}>Закрыть задание</Button>
                  : <Button size="small" variant="secondary" onClick={() => review({ status: "open" })}>Открыть снова</Button>}
              </div>
            </div>
          )}
        </div>
      ))}
    </Container>
  )
}

function ReviewStep({ n, s, onPatch }: { n: number; s: Step; onPatch: (p: { comment?: string | null; review?: "ok" | "redo" | null; remove_photo?: string }) => void }) {
  const [comment, setComment] = useState(s.comment ?? "")
  useEffect(() => { setComment(s.comment ?? "") }, [s.comment])
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base bg-ui-bg-base p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Text size="small" weight="plus">{n}. {s.title}</Text>
        {s.done_at ? <Badge size="2xsmall" color="green">сделано{s.done_by ? ` · ${s.done_by}` : ""} · {new Date(s.done_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Badge> : <Badge size="2xsmall" color="grey">не сделано</Badge>}
        {s.review === "ok" && <Badge size="2xsmall" color="green">принято</Badge>}
        {s.review === "redo" && <Badge size="2xsmall" color="red">на переделке</Badge>}
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle">{s.where} · {s.products.length} моделей{s.remove.length ? ` · убрать ${s.remove.length}` : ""}</Text>
      <div className="flex flex-wrap gap-2">
        {s.render && <a href={s.render} target="_blank" rel="noreferrer" title="Как должно быть"><img src={s.render} alt="" className="h-28 rounded-md border border-ui-border-base object-cover" /></a>}
        {s.photos.map((u) => (
          <div key={u} className="relative">
            <a href={u} target="_blank" rel="noreferrer" title="Фото консультанта"><img src={u} alt="" className="h-28 rounded-md object-cover" /></a>
            <button type="button" className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white" onClick={() => onPatch({ remove_photo: u })}>×</button>
          </div>
        ))}
        {!s.photos.length && <Text size="xsmall" className="self-center text-ui-fg-muted">Фото ещё нет</Text>}
      </div>
      <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Замечание для консультанта: что поправить" />
      <div className="flex flex-wrap gap-2">
        <Button size="small" variant="secondary" disabled={comment === (s.comment ?? "")} onClick={() => onPatch({ comment: comment || null })}>Сохранить замечание</Button>
        <Button size="small" variant="secondary" onClick={() => onPatch({ review: "ok", comment: comment || null })}>Принято</Button>
        <Button size="small" variant="danger" onClick={() => onPatch({ review: "redo", comment: comment || null })}>Переделать</Button>
      </div>
    </div>
  )
}
