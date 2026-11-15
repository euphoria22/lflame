import { Badge, Button, IconButton, Input, Label, Switch, Text } from "@medusajs/ui"
import { useMemo, useState } from "react"
import { capacityOf, CAT_NAME, MProduct, Place, Slot, usedOf } from "../../../lib/merch/autofill"
import { Item } from "./catalog"

/** Товары на выбранном оборудовании: порядок, удаление, добавление поиском, закрепление и ограничения для автораскладки */
export function EquipProducts({ item, slots, products, used, onSlots, onItem }: {
  item: Item
  slots: Slot[]
  products: Map<string, MProduct>
  /** Товары, уже стоящие на другом оборудовании */
  used: Set<string>
  onSlots: (s: Slot[]) => void
  onItem: (p: Partial<Item>) => void
}) {
  const cap = capacityOf(item)
  const fill = usedOf(slots)
  const [q, setQ] = useState("")
  const allowed = useMemo(() => [...new Set([...cap.railCats, ...cap.shelfCats])], [cap.railCats, cap.shelfCats])
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const words = s.split(/\s+/)
    return [...products.values()]
      .filter((p) => p.cat && allowed.includes(p.cat) && !slots.some((x) => x.p === p.id))
      .filter((p) => words.every((w) => `${p.brand ?? ""} ${p.title}`.toLowerCase().includes(w)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [q, products, allowed, slots])
  const brands = useMemo(() => [...new Set([...products.values()].map((p) => p.brand).filter(Boolean) as string[])].sort(), [products])

  if (!cap.rail && !cap.shelf) return null
  const add = (p: MProduct) => {
    const place: Place = cap.railCats.includes(p.cat ?? "") && cap.rail > 0 ? "rail" : "shelf"
    onSlots([...slots, { p: p.id, n: place === "rail" ? Math.min(3, Math.max(1, p.sizes.length)) : 1, place }])
    setQ("")
  }
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= slots.length) return
    const next = [...slots]
    ;[next[i], next[j]] = [next[j], next[i]]
    onSlots(next)
  }
  const toggle = (list: string[] | undefined, v: string) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v])

  return (
    <div className="flex flex-col gap-2 border-t border-ui-border-base pt-3">
      <div className="flex items-center justify-between">
        <Text size="small" weight="plus">Товары</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {cap.rail > 0 && `вешалок ${fill.rail} из ${cap.rail}`}{cap.rail > 0 && cap.shelf > 0 && " · "}{cap.shelf > 0 && `мест ${fill.shelf} из ${cap.shelf}`}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={!!item.lock} onCheckedChange={(v) => onItem({ lock: v || undefined })} />
        <Text size="xsmall">Закрепить — автораскладка не меняет</Text>
      </div>
      <div className="flex flex-col gap-1">
        <Label size="xsmall" className="text-ui-fg-subtle">Только эти категории (для автораскладки)</Label>
        <div className="flex flex-wrap gap-1">
          {allowed.map((c) => (
            <button key={c} type="button" onClick={() => onItem({ cats: toggle(item.cats, c).length ? toggle(item.cats, c) : undefined })}
              className={`rounded-full border px-2 py-0.5 text-xs ${item.cats?.includes(c) ? "border-ui-fg-interactive bg-ui-bg-highlight text-ui-fg-interactive" : "border-ui-border-base text-ui-fg-subtle"}`}>{CAT_NAME[c] ?? c}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label size="xsmall" className="text-ui-fg-subtle">Только бренды (через запятую)</Label>
        <Input size="small" list="merch-brands" placeholder="любые" value={(item.brands ?? []).join(", ")}
          onChange={(e) => { const v = e.target.value.split(",").map((x) => x.trim()).filter(Boolean); onItem({ brands: v.length ? v : undefined }) }} />
        <datalist id="merch-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
      </div>

      <div className="relative">
        <Input size="small" placeholder="Добавить товар: бренд или название…" value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 flex w-full flex-col overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
            {results.map((p) => (
              <button key={p.id} type="button" onClick={() => add(p)} className="flex items-center gap-2 px-2 py-1.5 text-left hover:bg-ui-bg-base-hover">
                {p.thumb ? <img src={p.thumb} alt="" className="h-9 w-7 flex-none rounded object-cover" /> : <div className="h-9 w-7 flex-none rounded bg-ui-bg-subtle" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{p.title}</div>
                  <div className="text-[11px] text-ui-fg-subtle">{p.brand} · {p.sizes.join(", ")}{used.has(p.id) ? " · уже в зале" : ""}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {slots.length === 0 && <Text size="xsmall" className="text-ui-fg-subtle">Пусто. Добавьте товары поиском или нажмите «Разложить товары» сверху.</Text>}
      <div className="flex flex-col">
        {slots.map((s, i) => {
          const p = products.get(s.p)
          return (
            <div key={s.p} className="flex items-center gap-2 border-t border-ui-border-base py-1.5 first:border-t-0">
              {p?.thumb ? <img src={p.thumb} alt="" className="h-11 w-9 flex-none rounded object-cover" /> : <div className="h-11 w-9 flex-none rounded bg-ui-bg-subtle" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs">{p ? p.title : "Нет в наличии"}</div>
                <div className="flex items-center gap-1 text-[11px] text-ui-fg-subtle">
                  {p ? `${p.brand ?? ""} · ${p.sizes.join(", ")}` : "товар закончился — уберите"}
                  {!p && <Badge size="2xsmall" color="red">нет</Badge>}
                </div>
              </div>
              <div className="flex flex-none items-center">
                <Text size="xsmall" className="w-8 text-right text-ui-fg-subtle" title={s.place === "rail" ? "вешалок" : "мест"}>{s.n}{s.place === "rail" ? "в" : "м"}</Text>
                <IconButton size="2xsmall" variant="transparent" onClick={() => move(i, -1)} title="Выше">↑</IconButton>
                <IconButton size="2xsmall" variant="transparent" onClick={() => move(i, 1)} title="Ниже">↓</IconButton>
                <IconButton size="2xsmall" variant="transparent" onClick={() => onSlots(slots.filter((_, j) => j !== i))} title="Убрать">×</IconButton>
              </div>
            </div>
          )
        })}
      </div>
      {slots.length > 0 && <Button size="small" variant="transparent" onClick={() => onSlots([])}>Очистить это оборудование</Button>}
    </div>
  )
}
