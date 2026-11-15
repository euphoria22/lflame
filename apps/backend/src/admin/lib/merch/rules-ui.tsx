import { Button, Container, Heading, Input, Select, Switch, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { Level, LEVEL_NAME, MerchSettings, MProduct } from "../../../lib/merch/autofill"

const LEVELS: Level[] = ["bridge", "premium", "luxury"]
const num = (v: number) => String(v).replace(".", ",")
const parse = (s: string) => Number(String(s).replace(",", "."))
const models = (n: number) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? "модель" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "модели" : "моделей" }

/** Правила выкладки: нормы по уровням и уровень/стиль/якорность каждого бренда */
export function RulesBlock({ settings, products, onSaved }: { settings: MerchSettings; products: MProduct[]; onSaved: (s: MerchSettings) => void }) {
  const [v, setV] = useState(settings)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => { setV(settings) }, [settings])
  const dirty = JSON.stringify(v) !== JSON.stringify(settings)

  // Бренды из товаров в наличии: сколько моделей, сначала крупные
  const brands = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) if (p.brand) m.set(p.brand, (m.get(p.brand) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [products])
  const styles = useMemo(() => [...new Set(Object.values(v.brands).map((b) => b.style).filter(Boolean) as string[])].sort(), [v.brands])

  const setLevel = (l: Level, k: keyof MerchSettings["levels"][Level], val: string) => {
    const n = parse(val)
    if (!Number.isFinite(n)) return
    setV({ ...v, levels: { ...v.levels, [l]: { ...v.levels[l], [k]: n } } })
  }
  const setBrand = (b: string, p: Partial<MerchSettings["brands"][string]>) =>
    setV({ ...v, brands: { ...v.brands, [b]: { ...v.brands[b], level: p.level ?? v.brands[b]?.level ?? v.default_level, ...p } } })

  const save = async () => {
    setBusy(true)
    try {
      const r = await fetch("/admin/merch/settings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? "Не сохранилось")
      onSaved(d.settings)
      toast.success("Правила сохранены — нажмите «Разложить товары», чтобы применить")
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const unset = brands.filter(([b]) => !v.brands[b]).length

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h2">Правила выкладки</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Уровень бренда задаёт плотность на штанге, сколько размеров вешать и что ставить лицом вперёд. Якорный бренд получает постоянный корнер.
            {unset > 0 && ` Не указан уровень у ${unset} брендов — для них «${LEVEL_NAME[v.default_level]}».`}
          </Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => setOpen(!open)}>{open ? "Свернуть" : "Открыть"}</Button>
          {dirty && <Button size="small" isLoading={busy} onClick={save}>Сохранить</Button>}
        </div>
      </div>
      {open && (
        <>
          <div className="overflow-x-auto px-6 py-4">
            <table className="text-sm">
              <thead>
                <tr className="text-left text-xs text-ui-fg-subtle">
                  <th className="pb-2 pr-4 font-normal">Уровень</th>
                  <th className="pb-2 pr-4 font-normal">Запас между вещами (1 — вплотную)</th>
                  <th className="pb-2 pr-4 font-normal">Размеров модели</th>
                  <th className="pb-2 pr-4 font-normal">Лицом вперёд: каждая N-я (0 — только главная вещь капсулы)</th>
                  <th className="pb-2 font-normal">Мест на полке за вещь</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((l) => (
                  <tr key={l}>
                    <td className="py-1 pr-4">{LEVEL_NAME[l]}</td>
                    {(["spacing", "max_sizes", "face_every", "shelf_cost"] as const).map((k) => (
                      <td key={k} className="py-1 pr-4"><Input size="small" className="w-20" defaultValue={num(v.levels[l][k] ?? 0)} key={`${l}${k}${settings.levels[l][k]}`} onBlur={(e) => setLevel(l, k, e.target.value)} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Text size="small" weight="plus">Вешалки, см</Text>
                <table className="mt-1 text-sm">
                  <thead><tr className="text-left text-xs text-ui-fg-subtle"><th className="pr-3 font-normal" /><th className="pr-3 font-normal">Ширина плечиков</th><th className="pr-3 font-normal">Высота</th><th className="font-normal">Толщина</th></tr></thead>
                  <tbody>
                    {(["top", "bottom"] as const).map((h) => (
                      <tr key={h}>
                        <td className="py-1 pr-3">{h === "top" ? "Для верха" : "Для низа"}</td>
                        {(["w", "h", "t"] as const).map((k) => (
                          <td key={k} className="py-1 pr-3"><Input size="small" className="w-20" defaultValue={num(v.hangers[h][k])} key={`${h}${k}${settings.hangers[h][k]}`}
                            onBlur={(e) => { const n = parse(e.target.value); if (Number.isFinite(n)) setV({ ...v, hangers: { ...v.hangers, [h]: { ...v.hangers[h], [k]: n } } }) }} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <Text size="small" weight="plus">Толщина вещи на вешалке, см</Text>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([["outer", "Верхняя одежда"], ["mid", "Свитеры, худи"], ["top", "Футболки, рубашки"], ["bottom", "Брюки, джинсы, шорты"]] as const).map(([k, t]) => (
                    <label key={k} className="flex items-center justify-between gap-2 text-sm">{t}
                      <Input size="small" className="w-20" defaultValue={num(v.garment_cm[k])} key={`g${k}${settings.garment_cm[k]}`}
                        onBlur={(e) => { const n = parse(e.target.value); if (Number.isFinite(n)) setV({ ...v, garment_cm: { ...v.garment_cm, [k]: n } }) }} />
                    </label>
                  ))}
                </div>
                <Text size="xsmall" className="mt-1 text-ui-fg-subtle">Шаг на штанге = толщина вещи (не меньше вешалки) × запас уровня. Вещь лицом вперёд занимает ширину плечиков.</Text>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Text size="small">Уровень по умолчанию</Text>
                <Select size="small" value={v.default_level} onValueChange={(x) => setV({ ...v, default_level: x as Level })}>
                  <Select.Trigger className="w-40"><Select.Value /></Select.Trigger>
                  <Select.Content>{LEVELS.map((l) => <Select.Item key={l} value={l}>{LEVEL_NAME[l]}</Select.Item>)}</Select.Content>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Text size="small">Плотность в фокус-зоне</Text>
                <Input size="small" className="w-20" defaultValue={num(v.focus_density)} onBlur={(e) => { const n = parse(e.target.value); if (Number.isFinite(n)) setV({ ...v, focus_density: n }) }} />
                <Text size="xsmall" className="text-ui-fg-subtle">0,75 — на четверть реже</Text>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={v.last_unit} onCheckedChange={(c) => setV({ ...v, last_unit: c })} />
                <Text size="small">Выставлять последнюю единицу (её могут купить на сайте)</Text>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            <Text size="small" weight="plus" className="mb-2">Бренды</Text>
            <datalist id="merch-styles">{["streetwear", "techwear", "classic", "denim", "спорт", ...styles].filter((x, i, a) => a.indexOf(x) === i).map((s) => <option key={s} value={s} />)}</datalist>
            <div className="grid gap-x-6 gap-y-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))" }}>
              {brands.map(([b, count]) => {
                const r = v.brands[b]
                return (
                  <div key={b} className="flex items-center gap-2 border-b border-ui-border-base py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{b}</div>
                      <div className="text-[11px] text-ui-fg-subtle">{count} {models(count)} в наличии</div>
                    </div>
                    <Select size="small" value={r?.level ?? ""} onValueChange={(x) => setBrand(b, { level: x as Level })}>
                      <Select.Trigger className="w-32"><Select.Value placeholder="уровень" /></Select.Trigger>
                      <Select.Content>{LEVELS.map((l) => <Select.Item key={l} value={l}>{LEVEL_NAME[l]}</Select.Item>)}</Select.Content>
                    </Select>
                    <Input size="small" className="w-28" list="merch-styles" placeholder="стиль" value={r?.style ?? ""} onChange={(e) => setBrand(b, { style: e.target.value || null })} />
                    <label className="flex items-center gap-1 text-xs" title="Постоянный корнер, без штрафа за повтор">
                      <input type="checkbox" checked={!!r?.anchor} onChange={(e) => setBrand(b, { anchor: e.target.checked })} /> якорный
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </Container>
  )
}
