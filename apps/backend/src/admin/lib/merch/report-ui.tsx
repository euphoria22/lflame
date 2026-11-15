import { Badge, Button, Container, Heading, Input, Select, Switch, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { areaShares, MerchSettings, MProduct } from "../../../lib/merch/autofill"

type Report = {
  layout: { id: string; name: string }; source: "offline" | "site"; retail_days: number
  equipment: { id: string; name: string; zone: string; models: number; brands: string[]; unit: string; size: number; qty: number; rev: number; per_unit: number }[]
  zones: { name: string; qty: number; rev: number; equipment: number }[]
  brands: { name: string; qty: number; rev: number; equipment: number }[]
  not_in_hall: { id: string; title: string; brand: string | null; thumb: string | null; role: string | null; q30: number; score: number }[]
  second_chance: { id: string; title: string; brand: string | null; thumb: string | null; last14: number; prev14: number; units: number }[]
  roles: { role: string; n: number }[]
}

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`
const pct = (n: number) => `${Math.round(n * 1000) / 10}`.replace(".", ",") + " %"

async function saveSettings(next: MerchSettings): Promise<MerchSettings> {
  const r = await fetch("/admin/merch/settings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message ?? "Не сохранилось")
  return d.settings
}

/** Отчёт эффективности выкладки по открытому варианту */
export function ReportBlock({ layoutId, onSelect }: { layoutId: string; onSelect: (id: string) => void }) {
  const [rep, setRep] = useState<Report | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    fetch(`/admin/merch/report?layout_id=${layoutId}`, { credentials: "include" }).then(async (r) => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? "Отчёт не загрузился")
      setRep(d)
    }).catch((e: Error) => toast.error(e.message))
  }, [layoutId])
  useEffect(() => { if (open) load() }, [open, load])
  const sync = async () => {
    setBusy(true)
    try {
      const r = await fetch("/admin/merch/report", { method: "POST", credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? "Не обновилось")
      toast.success(d.skipped ? d.skipped : `Продажи магазина обновлены: ${d.rows} строк`)
      load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0 flex-1">
          <Heading level="h2">Отчёт по выкладке</Heading>
          <Text size="small" className="text-ui-fg-subtle">Продажи магазина (розничные чеки МоегоСклада) за 30 дней по месту, где товар стоит в этом варианте: на метр штанги и на место полки, по зонам и брендам. Это оценка: покупатель мог увидеть вещь и на сайте.</Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" isLoading={busy} onClick={sync}>Обновить продажи</Button>
          <Button size="small" variant="secondary" onClick={() => setOpen(!open)}>{open ? "Свернуть" : "Открыть"}</Button>
        </div>
      </div>
      {open && !rep && <Text size="small" className="px-6 py-4">Загрузка…</Text>}
      {open && rep && (
        <div className="flex flex-col gap-6 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="2xsmall" color={rep.source === "offline" ? "green" : "orange"}>{rep.source === "offline" ? `балл по продажам магазина · ${rep.retail_days} дн.` : "продаж магазина нет — балл сайта"}</Badge>
            {rep.roles.map((r) => <Badge key={r.role} size="2xsmall">{r.role}: {r.n}</Badge>)}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <Text size="small" weight="plus" className="mb-2">По зонам</Text>
              <Table><Table.Header><Table.Row><Table.HeaderCell>Зона</Table.HeaderCell><Table.HeaderCell>Оборуд.</Table.HeaderCell><Table.HeaderCell>Шт.</Table.HeaderCell><Table.HeaderCell>Выручка</Table.HeaderCell></Table.Row></Table.Header>
                <Table.Body>{rep.zones.map((z) => <Table.Row key={z.name}><Table.Cell>{z.name}</Table.Cell><Table.Cell>{z.equipment}</Table.Cell><Table.Cell>{z.qty}</Table.Cell><Table.Cell>{rub(z.rev)}</Table.Cell></Table.Row>)}</Table.Body>
              </Table>
            </div>
            <div>
              <Text size="small" weight="plus" className="mb-2">По брендам</Text>
              <Table><Table.Header><Table.Row><Table.HeaderCell>Бренд</Table.HeaderCell><Table.HeaderCell>Оборуд.</Table.HeaderCell><Table.HeaderCell>Шт.</Table.HeaderCell><Table.HeaderCell>Выручка</Table.HeaderCell></Table.Row></Table.Header>
                <Table.Body>{rep.brands.slice(0, 15).map((z) => <Table.Row key={z.name}><Table.Cell>{z.name}</Table.Cell><Table.Cell>{z.equipment}</Table.Cell><Table.Cell>{z.qty}</Table.Cell><Table.Cell>{rub(z.rev)}</Table.Cell></Table.Row>)}</Table.Body>
              </Table>
            </div>
          </div>
          <div>
            <Text size="small" weight="plus" className="mb-2">Оборудование: выручка на метр штанги / на место полки</Text>
            <Table><Table.Header><Table.Row><Table.HeaderCell>Оборудование</Table.HeaderCell><Table.HeaderCell>Зона</Table.HeaderCell><Table.HeaderCell>Бренды</Table.HeaderCell><Table.HeaderCell>Шт.</Table.HeaderCell><Table.HeaderCell>Выручка</Table.HeaderCell><Table.HeaderCell>На ед.</Table.HeaderCell></Table.Row></Table.Header>
              <Table.Body>{rep.equipment.map((e) => (
                <Table.Row key={e.id} className="cursor-pointer" onClick={() => onSelect(e.id)}>
                  <Table.Cell>{e.name}</Table.Cell><Table.Cell>{e.zone}</Table.Cell><Table.Cell className="max-w-56 truncate">{e.brands.join(", ")}</Table.Cell>
                  <Table.Cell>{e.qty}</Table.Cell><Table.Cell>{rub(e.rev)}</Table.Cell><Table.Cell>{rub(e.per_unit)} / {e.unit}</Table.Cell>
                </Table.Row>
              ))}</Table.Body>
            </Table>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <Text size="small" weight="plus">Сильные товары, которых нет в зале</Text>
              <Text size="xsmall" className="mb-2 text-ui-fg-subtle">Высокий балл, но места не хватило — кандидаты на замену слабых позиций.</Text>
              {rep.not_in_hall.map((p) => (
                <div key={p.id} className="flex items-center gap-2 border-t border-ui-border-base py-1.5">
                  {p.thumb ? <img src={p.thumb} alt="" className="h-10 w-8 rounded object-cover" /> : <div className="h-10 w-8 rounded bg-ui-bg-subtle" />}
                  <div className="min-w-0 flex-1"><div className="truncate text-xs">{p.title}</div><div className="text-[11px] text-ui-fg-subtle">{p.brand} · продано за 30 дн.: {p.q30}{p.role ? ` · ${p.role}` : ""}</div></div>
                </div>
              ))}
            </div>
            <div>
              <Text size="small" weight="plus">«Второй шанс» в зале</Text>
              <Text size="xsmall" className="mb-2 text-ui-fg-subtle">Залежавшееся, поставленное на сильные места: продажи за последние 14 дней против предыдущих 14. Нет роста за 2–4 недели — кандидат на уценку.</Text>
              {rep.second_chance.length === 0 && <Text size="xsmall" className="text-ui-fg-muted">Таких товаров в этом варианте нет.</Text>}
              {rep.second_chance.map((p) => (
                <div key={p.id} className="flex items-center gap-2 border-t border-ui-border-base py-1.5">
                  {p.thumb ? <img src={p.thumb} alt="" className="h-10 w-8 rounded object-cover" /> : <div className="h-10 w-8 rounded bg-ui-bg-subtle" />}
                  <div className="min-w-0 flex-1"><div className="truncate text-xs">{p.title}</div><div className="text-[11px] text-ui-fg-subtle">{p.brand} · остаток {p.units}</div></div>
                  <Badge size="2xsmall" color={p.last14 > p.prev14 ? "green" : "grey"}>{p.prev14} → {p.last14}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

/** План площади, источник балла, довешивание */
export function PlanBlock({ settings, products, railCount, onSaved }: { settings: MerchSettings; products: MProduct[]; railCount: number; onSaved: (s: MerchSettings) => void }) {
  const [v, setV] = useState(settings)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { setV(settings) }, [settings])
  const dirty = JSON.stringify({ a: v.area_plan, s: v.score_source, r: v.replenish }) !== JSON.stringify({ a: settings.area_plan, s: settings.score_source, r: settings.replenish })
  const shares = useMemo(() => areaShares(products, v), [products, v])
  const total = shares.reduce((a, r) => a + r.share, 0)
  const save = async () => {
    setBusy("save")
    try { onSaved(await saveSettings({ ...settings, area_plan: v.area_plan, score_source: v.score_source, replenish: v.replenish })); toast.success("Сохранено — нажмите «Разложить товары», чтобы применить") } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const replenishNow = async () => {
    setBusy("rep")
    try {
      const r = await fetch("/admin/merch/replenish", { method: "POST", credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? "Не получилось")
      if (d.empty) toast.info("Вчера из текущей расстановки ничего не продали (или продажи магазина ещё не загружены)")
      else { await navigator.clipboard?.writeText(d.url).catch(() => undefined); toast.success(d.sent ? "Задание «Довесить» отправлено в рабочий чат" : "Задание создано, ссылка скопирована (рабочий чат не выбран)") }
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0 flex-1">
          <Heading level="h2">Продажи магазина в раскладке</Heading>
          <Text size="small" className="text-ui-fg-subtle">Чем ранжировать товары, сколько стоек положено бренду (план площади) и ежедневное довешивание проданного.</Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => setOpen(!open)}>{open ? "Свернуть" : "Открыть"}</Button>
          {dirty && <Button size="small" isLoading={busy === "save"} onClick={save}>Сохранить</Button>}
        </div>
      </div>
      {open && (
        <div className="flex flex-col gap-5 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Text size="small" weight="plus">Чем ранжировать товары</Text>
            <Select size="small" value={v.score_source} onValueChange={(x) => setV({ ...v, score_source: x as MerchSettings["score_source"] })}>
              <Select.Trigger className="w-72"><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="offline">Продажи магазина (офлайн-балл)</Select.Item>
                <Select.Item value="site">Балл сайта (умная сортировка)</Select.Item>
              </Select.Content>
            </Select>
            <Text size="xsmall" className="text-ui-fg-subtle">Офлайн-балл: продажи в магазине, маржа, остаток, полнота размеров, новизна, сезон. Пока продаж магазина нет — берётся балл сайта.</Text>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Switch checked={v.replenish.enabled} onCheckedChange={(c) => setV({ ...v, replenish: { ...v.replenish, enabled: c } })} />
            <Text size="small">Довешивание каждый день в</Text>
            <Input size="small" type="time" className="w-28" value={v.replenish.time} onChange={(e) => setV({ ...v, replenish: { ...v.replenish, time: e.target.value } })} />
            <Text size="xsmall" className="text-ui-fg-subtle">(Омск) — в рабочий чат: что из текущей расстановки продали вчера, принести со склада.</Text>
            <Button size="small" variant="secondary" isLoading={busy === "rep"} onClick={replenishNow}>Довесить сейчас</Button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Switch checked={v.area_plan.enabled} onCheckedChange={(c) => setV({ ...v, area_plan: { ...v.area_plan, enabled: c } })} />
              <Text size="small" weight="plus">План площади</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">Вес продаж</Text>
              <Input size="small" className="w-16" defaultValue={String(v.area_plan.mix).replace(".", ",")} onBlur={(e) => { const n = Number(e.target.value.replace(",", ".")); if (Number.isFinite(n)) setV({ ...v, area_plan: { ...v.area_plan, mix: Math.min(1, Math.max(0, n)) } }) }} />
              <Text size="xsmall" className="text-ui-fg-subtle">(0 — только по остатку, 1 — только по продажам). Стоек для одежды: {railCount}.</Text>
            </div>
            <Table>
              <Table.Header><Table.Row>
                <Table.HeaderCell>Бренд</Table.HeaderCell><Table.HeaderCell>Моделей</Table.HeaderCell><Table.HeaderCell>Доля продаж</Table.HeaderCell>
                <Table.HeaderCell>Доля остатка</Table.HeaderCell><Table.HeaderCell>Доля зала</Table.HeaderCell><Table.HeaderCell>Стоек</Table.HeaderCell><Table.HeaderCell>Вручную, %</Table.HeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {shares.slice(0, 25).map((r) => (
                  <Table.Row key={r.brand}>
                    <Table.Cell>{r.brand}</Table.Cell><Table.Cell>{r.models}</Table.Cell><Table.Cell>{pct(r.sales)}</Table.Cell><Table.Cell>{pct(r.stock)}</Table.Cell>
                    <Table.Cell>{pct(total ? r.share / total : 0)}{r.manual && <Badge size="2xsmall" className="ml-1">вручную</Badge>}</Table.Cell>
                    <Table.Cell>{Math.round((total ? r.share / total : 0) * railCount * 10) / 10}</Table.Cell>
                    <Table.Cell>
                      <Input size="small" className="w-20" placeholder="авто" defaultValue={v.area_plan.shares[r.brand] ?? ""}
                        onBlur={(e) => {
                          const shares = { ...v.area_plan.shares }
                          const t = e.target.value.trim().replace(",", ".")
                          if (!t) delete shares[r.brand]
                          else if (Number.isFinite(Number(t))) shares[r.brand] = Number(t)
                          setV({ ...v, area_plan: { ...v.area_plan, shares } })
                        }} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}
    </Container>
  )
}
