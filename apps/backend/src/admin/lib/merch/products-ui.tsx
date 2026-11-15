import { Badge, Button, IconButton, Input, Label, Switch, Text, toast } from "@medusajs/ui"
import { useMemo, useState } from "react"
import { ROLE_NAME } from "../../../lib/merch/offline"
import { Advice, adviceFor, adviceLevel, capacityOf, CAT_NAME, facingsOf, MerchSettings, MProduct, orderSlots, placeAllowed, railUsedM, Slot, suggestFor, usedOf, ZoneLike } from "../../../lib/merch/autofill"
import { Item } from "./catalog"

const LEVEL_CLS: Record<Advice["level"], string> = {
  bad: "text-ui-fg-error", warn: "text-ui-tag-orange-text", good: "text-ui-tag-green-text", info: "text-ui-fg-subtle",
}
const DOT_CLS: Record<Advice["level"], string> = {
  bad: "bg-ui-tag-red-icon", warn: "bg-ui-tag-orange-icon", good: "bg-ui-tag-green-icon", info: "bg-ui-border-strong",
}

/** Подсказки списком: что не так и почему */
function AdviceList({ items, max = 4 }: { items: Advice[]; max?: number }) {
  const order = { bad: 0, warn: 1, good: 2, info: 3 }
  const list = [...items].sort((a, b) => order[a.level] - order[b.level]).slice(0, max)
  if (!list.length) return null
  return (
    <ul className="mt-0.5 flex flex-col gap-0.5">
      {list.map((a, i) => (
        <li key={i} className={`flex gap-1.5 text-[11px] leading-snug ${LEVEL_CLS[a.level]}`}>
          <span className={`mt-[5px] h-1.5 w-1.5 flex-none rounded-full ${DOT_CLS[a.level]}`} />{a.text}
        </li>
      ))}
    </ul>
  )
}

/** Товары на выбранном оборудовании: порядок, удаление, добавление поиском, закрепление и ограничения для автораскладки */
export function EquipProducts({ item, zone, slots, products, used, settings, onSlots, onItem }: {
  settings: MerchSettings
  item: Item
  /** Зона, в которой стоит оборудование — от неё зависят подсказки */
  zone: ZoneLike | null
  slots: Slot[]
  products: Map<string, MProduct>
  /** Товары, уже стоящие на другом оборудовании */
  used: Set<string>
  onSlots: (s: Slot[]) => void
  onItem: (p: Partial<Item>) => void
}) {
  const cap = capacityOf(item)
  const fill = usedOf(slots)
  // Штанга — в метрах: вешалки, толщина вещей, запас по уровню бренда
  const railM = cap.railM ? railUsedM(slots, products, settings) : 0
  const m = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")
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
      .map((p) => ({ p, ...adviceFor(p, item, zone, slots, products, settings) }))
  }, [q, products, allowed, slots, item, zone, settings])
  const list = useMemo(() => [...products.values()], [products])
  const suggest = useMemo(() => (q.trim().length < 2 ? suggestFor(item, zone, slots, list, used, settings, 5) : []), [q, item, zone, slots, list, used, settings])
  const brands = useMemo(() => [...new Set([...products.values()].map((p) => p.brand).filter(Boolean) as string[])].sort(), [products])

  if (!cap.rail && !cap.shelf) return null
  const add = (p: MProduct) => {
    const { place } = adviceFor(p, item, zone, slots, products, settings)
    // Правило размещения — запрет: свитер на плечики не повесить даже вручную
    const rule = placeAllowed(p, place, item.type, settings)
    if (rule) { toast.error(rule.why || "Правила размещения не разрешают сюда", { description: "Правило можно поменять в разделе «Правила выкладки»" }); return }
    onSlots([...slots, { p: p.id, n: facingsOf(p, place, settings), place }])
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
          <span className={railM > cap.railM + 0.01 ? "text-ui-fg-error" : ""}>{cap.railM > 0 && `штанга ${m(railM)} из ${m(cap.railM)} м · вешалок ${fill.rail}`}</span>{cap.railM > 0 && cap.shelf > 0 && " · "}{cap.shelf > 0 && `мест ${fill.shelf} из ${cap.shelf}`}
        </Text>
      </div>
      {cap.railM > 0 && (
        <div className="flex items-center gap-2">
          <Switch checked={!!item.mix} onCheckedChange={(v) => onItem({ mix: v || undefined })} />
          <Text size="xsmall">Микс — лучшие вещи разных брендов (без брендового блока)</Text>
        </div>
      )}
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
        <Label size="xsmall" className="text-ui-fg-subtle">Пол (для автораскладки; унисекс подходит к обоим)</Label>
        <div className="flex gap-1">
          {([[undefined, "Любой"], ["men", "Только мужское"], ["women", "Только женское"]] as const).map(([g, t]) => (
            <button key={t} type="button" onClick={() => onItem({ gender: g })}
              className={`rounded-full border px-2 py-0.5 text-xs ${item.gender === g ? "border-ui-fg-interactive bg-ui-bg-highlight text-ui-fg-interactive" : "border-ui-border-base text-ui-fg-subtle"}`}>{t}</button>
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
            {results.map(({ p, advice }) => (
              <button key={p.id} type="button" onClick={() => add(p)} className="flex items-start gap-2 border-t border-ui-border-base px-2 py-1.5 text-left first:border-t-0 hover:bg-ui-bg-base-hover">
                {p.thumb ? <img src={p.thumb} alt="" className="h-9 w-7 flex-none rounded object-cover" /> : <div className="h-9 w-7 flex-none rounded bg-ui-bg-subtle" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{p.title}</div>
                  <div className="text-[11px] text-ui-fg-subtle">{p.brand} · {p.sizes.join(", ")}{used.has(p.id) ? " · уже в зале" : ""}</div>
                  <AdviceList items={advice.filter((a) => a.level !== "info")} max={2} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {suggest.length > 0 && (
        <div className="flex flex-col rounded-md border border-ui-border-base">
          <Text size="xsmall" className="px-2 pt-1.5 text-ui-fg-subtle">Подходит сюда — по баллу, правилам и зоне</Text>
          {suggest.map(({ p, advice }) => (
            <button key={p.id} type="button" onClick={() => add(p)} className="flex items-start gap-2 px-2 py-1.5 text-left hover:bg-ui-bg-base-hover">
              {p.thumb ? <img src={p.thumb} alt="" className="h-9 w-7 flex-none rounded object-cover" /> : <div className="h-9 w-7 flex-none rounded bg-ui-bg-subtle" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs">{p.title}</div>
                <div className="text-[11px] text-ui-fg-subtle">{p.brand} · {p.sizes.join(", ")}</div>
                <AdviceList items={advice.filter((a) => a.level === "good").length ? advice.filter((a) => a.level === "good") : [{ level: "info", text: "Высокий балл: продаётся и есть размеры" }]} max={1} />
              </div>
              <span className="flex-none text-xs text-ui-fg-interactive">+</span>
            </button>
          ))}
        </div>
      )}
      {slots.length > 1 && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-ui-bg-subtle px-2 py-1.5">
          <Text size="xsmall" className="text-ui-fg-subtle">Порядок на штанге: куртки → свитеры и худи → футболки и рубашки → низ; внутри — от светлого к тёмному</Text>
          <Button size="small" variant="secondary" className="flex-none" onClick={() => onSlots(orderSlots(slots, products))}>Упорядочить</Button>
        </div>
      )}
      {slots.length === 0 && <Text size="xsmall" className="text-ui-fg-subtle">Пусто. Добавьте товары поиском или нажмите «Разложить товары» сверху.</Text>}
      <div className="flex flex-col">
        {slots.map((s, i) => {
          const p = products.get(s.p)
          const adv = p ? adviceFor(p, item, zone, slots, products, settings).advice : []
          const lvl = adviceLevel(adv)
          return (
            <div key={s.p} className="flex items-start gap-2 border-t border-ui-border-base py-1.5 first:border-t-0">
              {p?.thumb ? <img src={p.thumb} alt="" className="h-11 w-9 flex-none rounded object-cover" /> : <div className="h-11 w-9 flex-none rounded bg-ui-bg-subtle" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs">{p ? p.title : "Нет в наличии"}</div>
                <div className="flex items-center gap-1 text-[11px] text-ui-fg-subtle">
                  {p ? `${p.brand ?? ""} · ${p.sizes.join(", ")}${p.q30 ? ` · продано ${p.q30}` : ""}` : "товар закончился — уберите"}
                  {p?.role && p.role !== "base" && <Badge size="2xsmall" color={p.role === "hit" || p.role === "new" ? "green" : p.role === "second_chance" ? "blue" : p.role === "offseason" || p.role === "hit_broken" ? "orange" : "grey"}>{ROLE_NAME[p.role]}</Badge>}
                  {!p && <Badge size="2xsmall" color="red">нет</Badge>}
                </div>
                {(lvl === "bad" || lvl === "warn") && <AdviceList items={adv.filter((a) => a.level === "bad" || a.level === "warn")} max={2} />}
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
