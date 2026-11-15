import { Badge, Button, Container, Heading, IconButton, Input, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { Checklist, Look, MerchSettings, MProduct, StandardKind } from "../../../lib/merch/autofill"

const uid = () => Math.random().toString(36).slice(2, 10)

async function saveSettings(next: MerchSettings): Promise<MerchSettings> {
  const r = await fetch("/admin/merch/settings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message ?? "Не сохранилось")
  return d.settings
}

function Section({ title, hint, open, setOpen, dirty, busy, onSave, children, badge }: {
  title: string; hint: string; open: boolean; setOpen: (v: boolean) => void; dirty: boolean; busy: boolean; onSave: () => void; children: React.ReactNode; badge?: string
}) {
  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><Heading level="h2">{title}</Heading>{badge && <Badge size="2xsmall">{badge}</Badge>}</div>
          <Text size="small" className="text-ui-fg-subtle">{hint}</Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => setOpen(!open)}>{open ? "Свернуть" : "Открыть"}</Button>
          {dirty && <Button size="small" isLoading={busy} onClick={onSave}>Сохранить</Button>}
        </div>
      </div>
      {open && children}
    </Container>
  )
}

const STD: { k: StandardKind; name: string }[] = [
  { k: "all", name: "Для всего оборудования" }, { k: "rail", name: "Штанги и стойки" }, { k: "shelf", name: "Полки, шкафы, сетка" },
  { k: "shoes", name: "Обувь" }, { k: "table", name: "Столы и подиумы" },
]

/** Стандарты магазина: подставляются в каждый шаг задания по типу оборудования */
export function StandardsBlock({ settings, onSaved }: { settings: MerchSettings; onSaved: (s: MerchSettings) => void }) {
  const [v, setV] = useState(settings.standards)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setV(settings.standards) }, [settings.standards])
  const dirty = JSON.stringify(v) !== JSON.stringify(settings.standards)
  const save = async () => {
    setBusy(true)
    try { onSaved(await saveSettings({ ...settings, standards: v })); toast.success("Стандарты сохранены — войдут в новые задания") } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Section title="Стандарты магазина" hint="Как у вас принято вешать, складывать и выставлять. Каждая строка — отдельное правило; они автоматически добавляются к шагам задания." open={open} setOpen={setOpen} dirty={dirty} busy={busy} onSave={save}>
      <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
        {STD.map(({ k, name }) => (
          <div key={k} className="flex flex-col gap-1">
            <Text size="small" weight="plus">{name}</Text>
            <Textarea rows={5} value={v[k].join("\n")} onChange={(e) => setV({ ...v, [k]: e.target.value.split("\n") })} />
          </div>
        ))}
      </div>
    </Section>
  )
}

/** Образы и капсулы мерчендайзера: ставятся первыми при раскладке */
export function LooksBlock({ settings, products, onSaved }: { settings: MerchSettings; products: MProduct[]; onSaved: (s: MerchSettings) => void }) {
  const [looks, setLooks] = useState<Look[]>(settings.looks)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState<Record<string, string>>({})
  useEffect(() => { setLooks(settings.looks) }, [settings.looks])
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const dirty = JSON.stringify(looks) !== JSON.stringify(settings.looks)
  const set = (id: string, p: Partial<Look>) => setLooks((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const save = async () => {
    setBusy(true)
    try { onSaved(await saveSettings({ ...settings, looks })); toast.success("Образы сохранены — нажмите «Разложить товары»") } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const search = (s: string, exclude: string[]) => {
    const words = s.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length || s.trim().length < 2) return []
    return products.filter((p) => !exclude.includes(p.id) && words.every((w) => `${p.brand ?? ""} ${p.title}`.toLowerCase().includes(w))).sort((a, b) => b.score - a.score).slice(0, 6)
  }
  /** Замена закончившегося: лучший по баллу товар того же бренда */
  const replacement = (look: Look) => {
    const ref = products.find((p) => look.products.includes(p.id))
    return ref ? products.filter((p) => p.brand === ref.brand && !look.products.includes(p.id)).sort((a, b) => b.score - a.score)[0] : undefined
  }
  const active = looks.filter((l) => l.active).length
  return (
    <Section title="Образы и капсулы" badge={active ? `активных: ${active}` : undefined}
      hint="Соберите образ (до 12 вещей) и выберите, где ему быть: на манекене (вещи образа повиснут рядом в размерах), на столе или в начале стойки. Раскладка ставит образы первыми и раскладывает остальное вокруг."
      open={open} setOpen={setOpen} dirty={dirty} busy={busy} onSave={save}>
      <div className="flex flex-col gap-4 px-6 py-4">
        {looks.map((l) => {
          const results = search(q[l.id] ?? "", l.products)
          return (
            <div key={l.id} className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input size="small" className="w-64" value={l.name} onChange={(e) => set(l.id, { name: e.target.value })} />
                <Select size="small" value={l.place} onValueChange={(v) => set(l.id, { place: v as Look["place"] })}>
                  <Select.Trigger className="w-44"><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="mannequin">На манекен</Select.Item>
                    <Select.Item value="table">На стол</Select.Item>
                    <Select.Item value="rail">В начало стойки</Select.Item>
                  </Select.Content>
                </Select>
                <div className="flex items-center gap-2"><Switch checked={l.active} onCheckedChange={(c) => set(l.id, { active: c })} /><Text size="small">Активен</Text></div>
                <Button size="small" variant="transparent" className="ml-auto" onClick={() => setLooks((x) => x.filter((y) => y.id !== l.id))}>Удалить</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {l.products.map((id) => {
                  const p = byId.get(id)
                  return (
                    <div key={id} className={`flex w-48 items-center gap-2 rounded-md border p-1.5 ${p ? "border-ui-border-base" : "border-ui-border-error"}`}>
                      {p?.thumb ? <img src={p.thumb} alt="" className="h-10 w-8 flex-none rounded object-cover" /> : <div className="h-10 w-8 flex-none rounded bg-ui-bg-subtle" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs">{p ? p.title : "Нет в наличии"}</div>
                        <div className="truncate text-[11px] text-ui-fg-subtle">{p ? `${p.brand ?? ""} · ${p.sizes.join(", ")}` : "замените"}</div>
                      </div>
                      <IconButton size="2xsmall" variant="transparent" onClick={() => set(l.id, { products: l.products.filter((x) => x !== id) })}>×</IconButton>
                    </div>
                  )
                })}
              </div>
              {l.products.some((id) => !byId.get(id)) && (() => {
                const alt = replacement(l)
                return alt ? <Text size="xsmall" className="text-ui-fg-subtle">Часть вещей закончилась. Можно заменить, например: <button type="button" className="text-ui-fg-interactive" onClick={() => set(l.id, { products: [...l.products.filter((x) => byId.get(x)), alt.id] })}>{alt.title}</button></Text> : null
              })()}
              {l.products.length < 12 && (
                <div className="relative w-96">
                  <Input size="small" placeholder="Добавить вещь: бренд или название…" value={q[l.id] ?? ""} onChange={(e) => setQ({ ...q, [l.id]: e.target.value })} />
                  {results.length > 0 && (
                    <div className="absolute z-10 mt-1 flex w-full flex-col overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
                      {results.map((p) => (
                        <button key={p.id} type="button" className="flex items-center gap-2 px-2 py-1.5 text-left hover:bg-ui-bg-base-hover"
                          onClick={() => { set(l.id, { products: [...l.products, p.id] }); setQ({ ...q, [l.id]: "" }) }}>
                          {p.thumb ? <img src={p.thumb} alt="" className="h-9 w-7 flex-none rounded object-cover" /> : <div className="h-9 w-7 flex-none rounded bg-ui-bg-subtle" />}
                          <div className="min-w-0 flex-1"><div className="truncate text-xs">{p.title}</div><div className="text-[11px] text-ui-fg-subtle">{p.brand} · {p.sizes.join(", ")}</div></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <Button size="small" variant="secondary" className="self-start" onClick={() => setLooks([...looks, { id: uid(), name: "Новый образ", place: "mannequin", products: [], active: true }])}>Добавить образ</Button>
      </div>
    </Section>
  )
}

const DAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]

/** Повторяющиеся чек-листы: по расписанию в рабочий чат тем, кто на смене */
export function ChecklistsBlock({ settings, onSaved }: { settings: MerchSettings; onSaved: (s: MerchSettings) => void }) {
  const [list, setList] = useState<Checklist[]>(settings.checklists)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { setList(settings.checklists) }, [settings.checklists])
  const dirty = JSON.stringify(list) !== JSON.stringify(settings.checklists)
  const set = (id: string, p: Partial<Checklist>) => setList((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const save = async () => {
    setBusy("save")
    try { onSaved(await saveSettings({ ...settings, checklists: list })); toast.success("Чек-листы сохранены") } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const sendNow = async (id: string) => {
    setBusy(id)
    try {
      const r = await fetch(`/admin/merch/checklists/${id}/send`, { method: "POST", credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? "Не отправилось")
      await navigator.clipboard?.writeText(d.url).catch(() => undefined)
      toast.success(d.sent ? "Отправлено в рабочий чат, ссылка скопирована" : "Создано (рабочий чат не выбран), ссылка скопирована")
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const on = list.filter((c) => c.enabled).length
  return (
    <Section title="Чек-листы" badge={on ? `по расписанию: ${on}` : undefined}
      hint="Повторяющиеся проверки: в выбранные дни и время (Омск) ссылка приходит в рабочий чат из «Смен» с упоминанием тех, кто на смене. Выполнение видно ниже, в «Заданиях консультантам»."
      open={open} setOpen={setOpen} dirty={dirty} busy={busy === "save"} onSave={save}>
      <div className="flex flex-col gap-4 px-6 py-4">
        {list.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input size="small" className="w-56" value={c.name} onChange={(e) => set(c.id, { name: e.target.value })} />
              <div className="flex gap-1">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" onClick={() => set(c.id, { days: c.days.includes(i) ? c.days.filter((x) => x !== i) : [...c.days, i].sort() })}
                    className={`h-7 w-8 rounded-md border text-xs ${c.days.includes(i) ? "border-ui-fg-interactive bg-ui-bg-highlight text-ui-fg-interactive" : "border-ui-border-base text-ui-fg-subtle"}`}>{d}</button>
                ))}
              </div>
              <Input size="small" type="time" className="w-28" value={c.time} onChange={(e) => set(c.id, { time: e.target.value })} />
              <div className="flex items-center gap-2"><Switch checked={c.enabled} disabled={!c.days.length} onCheckedChange={(v) => set(c.id, { enabled: v })} /><Text size="small">{c.days.length ? "По расписанию" : "Только вручную"}</Text></div>
              <div className="ml-auto flex gap-1">
                <Button size="small" variant="secondary" disabled={dirty} isLoading={busy === c.id} onClick={() => sendNow(c.id)} title={dirty ? "Сначала сохраните" : ""}>Отправить сейчас</Button>
                <Button size="small" variant="transparent" onClick={() => setList((l) => l.filter((x) => x.id !== c.id))}>Удалить</Button>
              </div>
            </div>
            <Textarea rows={Math.min(8, Math.max(3, c.items.length))} value={c.items.join("\n")} onChange={(e) => set(c.id, { items: e.target.value.split("\n") })} placeholder="Каждая строка — пункт" />
          </div>
        ))}
        <Button size="small" variant="secondary" className="self-start" onClick={() => setList([...list, { id: uid(), name: "Новый чек-лист", items: ["Пункт 1"], days: [], time: "12:00", enabled: false }])}>Добавить чек-лист</Button>
      </div>
    </Section>
  )
}
