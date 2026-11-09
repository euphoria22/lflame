import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Plus, Star, Trash } from "@medusajs/icons"
import { Badge, Button, Container, Drawer, Heading, IconButton, Input, Label, Select, Switch, Table, Tabs, Text, Textarea, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Tier = { code: string; name: string; threshold: number; discount: number }
type Settings = {
  enabled: boolean; tiers: Tier[]; period_days: number; online_delay_days: number; offline_delay_days: number; warn_days: number
  excluded_brands: string[]; excluded_counterparties: string[]
}
type Member = { id: string; phone: string; name: string | null; email: string | null; total: number; level: string; level_override: string | null; override_reason?: string | null }
type Entry = { id: string; source: string; doc_type: string; doc_name: string | null; amount: number; purchased_at: string; credit_at: string; status: string; note: string | null }
type ImportState = { running: string | null; started_at: string | null; result: Record<string, unknown> | null; error: string | null }
type MembersResp = { members: Member[]; total: number; counts: Record<string, number>; imported_at: string | null; import: ImportState }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { message?: string }).message ?? `Ошибка ${res.status}`)
  return body as T
}

const rub = (n: number) => `${Math.round(Number(n)).toLocaleString("ru-RU")} ₽`
const date = (s: string) => new Date(s).toLocaleDateString("ru-RU")
const STATUS: Record<string, { label: string; color: "green" | "orange" | "grey" }> = {
  credited: { label: "Засчитано", color: "green" }, pending: { label: "Ожидает", color: "orange" }, cancelled: { label: "Отменено", color: "grey" },
}
const SOURCE: Record<string, string> = { online: "Сайт", offline: "Магазин / МС", manual: "Вручную" }

/** Программа лояльности LAFLAMME (ТЗ, п. 6.7): участники, журнал, настройки уровней. */
const LoyaltyPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [data, setData] = useState<MembersResp | null>(null)
  const [q, setQ] = useState("")
  const [level, setLevel] = useState("")
  const [open, setOpen] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    const p = new URLSearchParams({ q, level })
    setData(await api<MembersResp>(`/admin/loyalty/members?${p}`))
  }, [q, level])

  useEffect(() => { api<{ settings: Settings }>("/admin/loyalty/settings").then((d) => setSettings(d.settings)).catch((e) => toast.error(e.message)) }, [])
  useEffect(() => { const t = setTimeout(() => loadMembers().catch((e) => toast.error(e.message)), 250); return () => clearTimeout(t) }, [loadMembers])
  // Пока идёт импорт — обновляем каждые 3 секунды
  useEffect(() => {
    if (!data?.import.running) return
    const t = setInterval(() => loadMembers().catch(() => null), 3000)
    return () => clearInterval(t)
  }, [data?.import.running, loadMembers])

  const run = async (action: string) => {
    try {
      await api("/admin/loyalty/run", { method: "POST", body: JSON.stringify({ action }) })
      toast.info("Запущено — результат появится здесь")
      await loadMembers()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (!settings || !data) return <Container className="p-6"><Text>Загрузка…</Text></Container>
  const imp = data.import

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h1">LAFLAMME Club — программа лояльности</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Уровень — по сумме покупок за {settings.period_days} дней: сайт + магазин (из МоегоСклада). Клиент = номер телефона.
          </Text>
        </div>
        <Badge color={settings.enabled ? "green" : "grey"}>{settings.enabled ? "Работает" : "Выключена"}</Badge>
      </Container>

      <Tabs defaultValue="members">
        <Tabs.List>
          <Tabs.Trigger value="members">Участники</Tabs.Trigger>
          <Tabs.Trigger value="settings">Настройки</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="members" className="mt-3 flex flex-col gap-y-3">
          <Container className="grid grid-cols-2 gap-3 px-6 py-4 md:grid-cols-5">
            {settings.tiers.map((t) => (
              <button key={t.code} type="button" onClick={() => setLevel(level === t.code ? "" : t.code)}
                className={`rounded-lg border p-3 text-left transition-colors ${level === t.code ? "border-ui-border-interactive" : "border-ui-border-base"}`}>
                <Text size="xsmall" className="text-ui-fg-subtle">{t.name} · {t.discount}%</Text>
                <Text size="xlarge" weight="plus">{data.counts[t.code] ?? 0}</Text>
                <Text size="xsmall" className="text-ui-fg-muted">от {rub(t.threshold)}</Text>
              </button>
            ))}
          </Container>

          <Container className="flex flex-wrap items-center gap-3 px-6 py-4">
            <Button size="small" variant="secondary" isLoading={imp.running === "import"} disabled={!!imp.running} onClick={() => run("import")}>Загрузить новые продажи из МС</Button>
            <Button size="small" variant="secondary" isLoading={imp.running === "nightly"} disabled={!!imp.running} onClick={() => run("nightly")}>Пересчитать уровни</Button>
            <Button size="small" variant="transparent" isLoading={imp.running === "reimport"} disabled={!!imp.running} onClick={() => { if (confirm("Загрузить заново все продажи за период? Это займёт несколько минут.")) run("reimport") }}>Загрузить всё заново</Button>
            <Text size="small" className="text-ui-fg-subtle">
              {imp.running ? "Выполняется…" : imp.error ? `Ошибка: ${imp.error}` : data.imported_at ? `Последняя загрузка из МС: ${new Date(data.imported_at).toLocaleString("ru-RU")}` : "Продажи из МС ещё не загружались"}
              {!imp.running && imp.result && ` · ${Object.entries(imp.result).filter(([k]) => ["docs", "created", "updated", "members", "credited", "warned"].includes(k)).map(([k, v]) => `${({ docs: "документов", created: "новых", updated: "изменено", members: "клиентов", credited: "засчитано", warned: "предупреждений" } as Record<string, string>)[k]}: ${v}`).join(", ")}`}
            </Text>
          </Container>

          <Container className="p-0">
            <div className="flex items-center gap-3 px-6 py-4">
              <Input size="small" type="search" placeholder="Телефон, имя или email" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
              <Text size="small" className="text-ui-fg-subtle">Найдено: {data.total}{data.total > 200 ? " (показаны первые 200)" : ""}</Text>
            </div>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Клиент</Table.HeaderCell>
                  <Table.HeaderCell>Телефон</Table.HeaderCell>
                  <Table.HeaderCell>Уровень</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Сумма за период</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.members.map((m) => (
                  <Table.Row key={m.id} className="cursor-pointer" onClick={() => setOpen(m.phone)}>
                    <Table.Cell>{m.name || "—"}<Text size="xsmall" className="text-ui-fg-subtle">{m.email ?? ""}</Text></Table.Cell>
                    <Table.Cell>{m.phone}</Table.Cell>
                    <Table.Cell><Badge size="2xsmall" color={m.level === settings.tiers[0]?.code ? "grey" : "blue"}>{m.level}{m.level_override ? " · вручную" : ""}</Badge></Table.Cell>
                    <Table.Cell className="text-right">{rub(m.total)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            {!data.members.length && <Text size="small" className="px-6 py-6 text-ui-fg-subtle">Пока никого. Нажмите «Загрузить новые продажи из МС» — клиенты с телефонами появятся здесь.</Text>}
          </Container>
        </Tabs.Content>

        <Tabs.Content value="settings" className="mt-3">
          <SettingsForm settings={settings} onSaved={(s) => { setSettings(s); loadMembers().catch(() => null) }} />
        </Tabs.Content>
      </Tabs>

      <MemberDrawer phone={open} tiers={settings.tiers} onClose={() => setOpen(null)} onChanged={() => loadMembers().catch(() => null)} />
    </div>
  )
}

function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [s, setS] = useState(settings)
  const [saving, setSaving] = useState(false)
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value.replace(/\D/g, "") || 0) })
  const tier = (i: number, patch: Partial<Tier>) => setS({ ...s, tiers: s.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) })

  const save = async () => {
    setSaving(true)
    try {
      const d = await api<{ settings: Settings }>("/admin/loyalty/settings", { method: "POST", body: JSON.stringify(s) })
      setS(d.settings); onSaved(d.settings)
      toast.success("Сохранено. Уровни пересчитаются ночью или по кнопке «Пересчитать уровни».")
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} id="enabled" />
          <Label htmlFor="enabled">Программа работает (скидка в корзине, начисления)</Label>
        </div>
        <Button onClick={save} isLoading={saving}>Сохранить</Button>
      </div>

      <div className="flex flex-col gap-y-2 px-6 py-5">
        <Heading level="h2">Уровни</Heading>
        <div className="grid grid-cols-[110px_1fr_160px_110px_32px] gap-2 text-ui-fg-subtle txt-small">
          <span>Код</span><span>Название</span><span>Сумма от, ₽</span><span>Скидка, %</span><span />
        </div>
        {s.tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[110px_1fr_160px_110px_32px] items-center gap-2">
            <Input size="small" value={t.code} onChange={(e) => tier(i, { code: e.target.value.toUpperCase() })} />
            <Input size="small" value={t.name} onChange={(e) => tier(i, { name: e.target.value })} />
            <Input size="small" inputMode="numeric" value={String(t.threshold)} onChange={(e) => tier(i, { threshold: Number(e.target.value.replace(/\D/g, "") || 0) })} />
            <Input size="small" inputMode="numeric" value={String(t.discount)} onChange={(e) => tier(i, { discount: Number(e.target.value.replace(/[^\d.]/g, "") || 0) })} />
            <IconButton size="small" variant="transparent" aria-label="Удалить уровень" onClick={() => setS({ ...s, tiers: s.tiers.filter((_, j) => j !== i) })}><Trash /></IconButton>
          </div>
        ))}
        <Button size="small" variant="secondary" className="w-fit" onClick={() => setS({ ...s, tiers: [...s.tiers, { code: "NEW", name: "Новый", threshold: 0, discount: 0 }] })}><Plus /> Добавить уровень</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 py-5 md:grid-cols-4">
        {([
          ["period_days", "Период накопления, дней", "365 = скользящие 12 месяцев"],
          ["online_delay_days", "Зачёт покупки на сайте через, дней", "после получения заказа"],
          ["offline_delay_days", "Зачёт покупки в магазине через, дней", "0 — сразу по чеку"],
          ["warn_days", "Предупреждать о понижении за, дней", "письмо клиенту"],
        ] as [keyof Settings, string, string][]).map(([k, label, hint]) => (
          <div key={k} className="flex flex-col gap-y-1">
            <Label size="small">{label}</Label>
            <Input size="small" inputMode="numeric" value={String(s[k])} onChange={num(k)} />
            <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>
          </div>
        ))}
      </div>

      <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
        <div className="flex flex-col gap-y-1">
          <Label size="small">Бренды без скидки уровня</Label>
          <Textarea rows={4} value={s.excluded_brands.join("\n")} onChange={(e) => setS({ ...s, excluded_brands: e.target.value.split("\n") })} placeholder={"Stone Island\nYeezy Gap"} />
          <Text size="xsmall" className="text-ui-fg-subtle">По одному в строке, как название бренда на сайте.</Text>
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="small">Контрагенты МС, которые не участвуют</Label>
          <Textarea rows={4} value={s.excluded_counterparties.join("\n")} onChange={(e) => setS({ ...s, excluded_counterparties: e.target.value.split("\n") })} />
          <Text size="xsmall" className="text-ui-fg-subtle">Часть названия: обезличенные («Розничный покупатель», «Самовывоз»), оптовики.</Text>
        </div>
      </div>
    </Container>
  )
}

function MemberDrawer({ phone, tiers, onClose, onChanged }: { phone: string | null; tiers: Tier[]; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<{ member: Member; entries: Entry[]; forecast: { level: string; future: string; need: number; until: string } | null } | null>(null)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [override, setOverride] = useState("")
  const [overrideReason, setOverrideReason] = useState("")

  const load = useCallback(async () => {
    if (!phone) return
    const r = await api<NonNullable<typeof d>>(`/admin/loyalty/members/${encodeURIComponent(phone)}`)
    setD(r); setOverride(r.member.level_override ?? ""); setOverrideReason(r.member.override_reason ?? "")
  }, [phone])
  useEffect(() => { setD(null); load().catch((e) => toast.error(e.message)) }, [load])

  const adjust = async () => {
    try {
      await api("/admin/loyalty/adjust", { method: "POST", body: JSON.stringify({ phone, amount: Number(amount.replace(/[^\d-]/g, "")), reason }) })
      setAmount(""); setReason(""); toast.success("Корректировка записана"); await load(); onChanged()
    } catch (e) { toast.error((e as Error).message) }
  }
  const saveOverride = async () => {
    try {
      await api("/admin/loyalty/override", { method: "POST", body: JSON.stringify({ phone, level: override || null, reason: overrideReason }) })
      toast.success(override ? "Уровень назначен вручную" : "Ручной уровень снят"); await load(); onChanged()
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <Drawer open={!!phone} onOpenChange={(v) => { if (!v) onClose() }}>
      <Drawer.Content>
        <Drawer.Header><Drawer.Title>{d?.member.name || phone}</Drawer.Title></Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          {!d ? <Text>Загрузка…</Text> : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge color="blue">{d.member.level}{d.member.level_override ? " (вручную)" : ""}</Badge>
                <Text weight="plus">{rub(d.member.total)}</Text>
                <Text size="small" className="text-ui-fg-subtle">{d.member.phone}{d.member.email ? ` · ${d.member.email}` : ""}</Text>
              </div>
              {d.forecast && <Text size="small" className="text-ui-fg-subtle">Скоро понизится с {d.forecast.level} до {d.forecast.future}, если не купит на {rub(d.forecast.need)} до {date(d.forecast.until)}.</Text>}

              <div className="flex flex-col gap-y-2">
                <Heading level="h3">Журнал</Heading>
                {d.entries.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-3 border-b border-ui-border-base pb-2">
                    <div>
                      <Text size="small">{e.doc_name ?? e.doc_type}</Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">{date(e.purchased_at)} · {SOURCE[e.source] ?? e.source}{e.status === "pending" ? ` · засчитается ${date(e.credit_at)}` : ""}{e.note ? ` · ${e.note}` : ""}</Text>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Text size="small" weight="plus">{e.amount > 0 ? "+" : ""}{rub(e.amount)}</Text>
                      <Badge size="2xsmall" color={STATUS[e.status]?.color ?? "grey"}>{STATUS[e.status]?.label ?? e.status}</Badge>
                    </div>
                  </div>
                ))}
                {!d.entries.length && <Text size="small" className="text-ui-fg-subtle">Записей нет</Text>}
              </div>

              <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-3">
                <Heading level="h3">Корректировка суммы</Heading>
                <Input size="small" placeholder="Сумма, ₽ (минус — уменьшить)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Input size="small" placeholder="Причина (обязательно)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button size="small" variant="secondary" className="w-fit" onClick={adjust}>Записать</Button>
              </div>

              <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-3">
                <Heading level="h3">Уровень вручную</Heading>
                <Select value={override || "auto"} onValueChange={(v) => setOverride(v === "auto" ? "" : v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="auto">По сумме покупок (автоматически)</Select.Item>
                    {tiers.map((t) => <Select.Item key={t.code} value={t.code}>{t.name} · {t.discount}%</Select.Item>)}
                  </Select.Content>
                </Select>
                {override && <Input size="small" placeholder="Причина (обязательно)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />}
                <Button size="small" variant="secondary" className="w-fit" onClick={saveOverride}>Сохранить</Button>
              </div>
            </>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}

export const config = defineRouteConfig({
  label: "Лояльность",
  icon: Star,
})

export default LoyaltyPage
