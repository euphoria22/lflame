import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront, Trash } from "@medusajs/icons"
import { Badge, Button, Container, Heading, IconButton, Input, Label, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CATALOG, capacity, draftLayout, FINISH_NAME, GROUP_COLOR, GROUP_NAME, Group, Item, LayoutData, Opening, typeOf, uid, WALL_NAME, WallFinish, WallSide, Zone } from "../../lib/merch/catalog"
import { extents, Plan } from "../../lib/merch/plan"
import type { CameraPreset, MerchScene, ProductLook, ViewMode } from "../../lib/merch/scene"
import { autofill, COLOR_HEX, kindOf, MProduct, Slot } from "../../../lib/merch/autofill"
import { EquipProducts } from "../../lib/merch/products-ui"
import { TasksBlock } from "../../lib/merch/tasks-ui"

type LayoutInfo = { id: string; name: string; is_current: boolean; items: number; updated_at: string; author: string | null }

const api = async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
  const r = await fetch(`/admin/merch${path}`, {
    method, credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message ?? `Ошибка (ответ сервера ${r.status})`)
  return d as T
}

const num = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")
const parse = (s: string) => Number(String(s).replace(",", "."))

/** Поле-число в метрах: ввод с запятой, применяется по Enter/уходу с поля */
const NumField = ({ label, value, onChange, step = 0.05, suffix = "м", min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; min?: number }) => {
  const [v, setV] = useState(num(value))
  useEffect(() => { setV(num(value)) }, [value])
  const apply = () => {
    const n = parse(v)
    if (Number.isFinite(n) && n >= min) onChange(Math.round(n / step) * step)
    else setV(num(value))
  }
  return (
    <div className="flex flex-col gap-1">
      <Label size="xsmall" className="text-ui-fg-subtle">{label}</Label>
      <div className="flex items-center gap-1">
        <Input size="small" value={v} onChange={(e) => setV(e.target.value)} onBlur={apply} onKeyDown={(e) => { if (e.key === "Enter") apply() }} />
        <Text size="xsmall" className="text-ui-fg-muted">{suffix}</Text>
      </div>
    </div>
  )
}

/** 3D-вид: three.js грузится только когда открыт */
const Scene3D = ({ data, selected, clothes, zones, looks, onSelect, onMove, sceneRef }: {
  data: LayoutData; selected: string | null; clothes: boolean; zones: boolean; looks: Map<string, ProductLook>
  onSelect: (id: string | null) => void; onMove: (id: string, x: number, y: number) => void; sceneRef: React.MutableRefObject<MerchScene | null>
}) => {
  const el = useRef<HTMLDivElement>(null)
  const cbs = useRef({ onSelect, onMove })
  cbs.current = { onSelect, onMove }
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let scene: MerchScene | null = null
    let alive = true
    import("../../lib/merch/scene").then(({ MerchScene }) => {
      if (!alive || !el.current) return
      try {
        scene = new MerchScene(el.current, { onSelect: (id) => cbs.current.onSelect(id), onMove: (id, x, y) => cbs.current.onMove(id, x, y) })
        sceneRef.current = scene
        setReady(true)
      } catch (e) { setError((e as Error).message) }
    }).catch((e: Error) => setError(e.message))
    return () => { alive = false; scene?.dispose(); sceneRef.current = null }
  }, [sceneRef])
  useEffect(() => { if (ready) sceneRef.current?.setData(data, { clothes, zones, selected, looks }) }, [ready, data, clothes, zones, selected, looks, sceneRef])
  return (
    <div ref={el} className="relative h-full w-full overflow-hidden rounded-md bg-black">
      {!ready && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Загрузка 3D…</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70">3D не запустилось в этом браузере: {error}</div>}
    </div>
  )
}

const GROUPS: Group[] = ["hang", "shelf", "table", "decor", "service", "build"]

const MerchPage = () => {
  const [layouts, setLayouts] = useState<LayoutInfo[]>([])
  const [curId, setCurId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [data, setData] = useState<LayoutData | null>(null)
  const [savedJson, setSavedJson] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<"split" | "plan" | "3d">("split")
  const [mode, setMode] = useState<ViewMode>("orbit")
  const [clothes, setClothes] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [products, setProducts] = useState<MProduct[]>([])
  const history = useRef<LayoutData[]>([])
  const future = useRef<LayoutData[]>([])
  const committed = useRef<LayoutData | null>(null)
  const sceneRef = useRef<MerchScene | null>(null)

  const dirty = !!data && JSON.stringify(data) !== savedJson

  const open = useCallback(async (id: string) => {
    const { layout } = await api<{ layout: { id: string; name: string; data: LayoutData } }>(`/layouts/${id}`)
    const d = { ...({ zones: [], background: null } as Partial<LayoutData>), ...layout.data } as LayoutData
    setCurId(layout.id); setName(layout.name); setData(d); setSavedJson(JSON.stringify(d))
    committed.current = d; history.current = []; future.current = []; setSelected(null)
  }, [])

  const loadList = useCallback(async (openId?: string) => {
    let { layouts } = await api<{ layouts: LayoutInfo[] }>("/layouts")
    if (!layouts.length) {
      // Первый вход: черновик по плану зала
      await api("/layouts", "POST", { name: "Текущая расстановка", data: draftLayout() })
      layouts = (await api<{ layouts: LayoutInfo[] }>("/layouts")).layouts
    }
    setLayouts(layouts)
    const target = openId ?? layouts.find((l) => l.is_current)?.id ?? layouts[0].id
    await open(target)
  }, [open])

  useEffect(() => { loadList().catch((e: Error) => toast.error(e.message)) }, [loadList])
  useEffect(() => {
    api<{ products: MProduct[] }>("/products").then((d) => setProducts(d.products)).catch((e: Error) => toast.error(`Товары не загрузились: ${e.message}`))
  }, [])
  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  // Вид и цвет вещи в 3D: по категории и цвету товара
  const looks = useMemo(() => {
    const m = new Map<string, ProductLook>()
    for (const sl of Object.values(data?.assign ?? {}).flat()) {
      const p = pmap.get(sl.p)
      m.set(sl.p, { kind: kindOf(p?.cat ?? null, sl.place), color: COLOR_HEX[p?.color ?? ""] ?? "#8a8d91" })
    }
    return m
  }, [data?.assign, pmap])

  /** Изменение расстановки. live — промежуточный шаг перетаскивания (в историю попадёт одно действие) */
  const change = useCallback((d: LayoutData, live = false) => {
    setData(d)
    if (live) return
    if (committed.current && JSON.stringify(committed.current) !== JSON.stringify(d)) {
      history.current = [...history.current.slice(-60), committed.current]
      future.current = []
    }
    committed.current = d
  }, [])
  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (!prev || !committed.current) return
    future.current.push(committed.current)
    committed.current = prev
    setData(prev)
  }, [])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next || !committed.current) return
    history.current.push(committed.current)
    committed.current = next
    setData(next)
  }, [])

  const selItem = data?.items.find((i) => i.id === selected) ?? null
  const selZone = data?.zones.find((z) => z.id === selected) ?? null
  const patchItem = (id: string, p: Partial<Item>) => data && change({ ...data, items: data.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })
  const patchZone = (id: string, p: Partial<Zone>) => data && change({ ...data, zones: data.zones.map((z) => (z.id === id ? { ...z, ...p } : z)) })
  const removeSel = () => {
    if (!data || !selected) return
    change({ ...data, items: data.items.filter((i) => i.id !== selected), zones: data.zones.filter((z) => z.id !== selected) })
    setSelected(null)
  }
  const duplicate = () => {
    if (!data || !selItem) return
    const copy = { ...selItem, id: uid(), x: Math.min(data.room.width, selItem.x + 0.4), y: Math.min(data.room.length, selItem.y + 0.4) }
    change({ ...data, items: [...data.items, copy] })
    setSelected(copy.id)
  }
  const addItem = (type: string) => {
    if (!data) return
    const t = typeOf(type)
    const it: Item = { id: uid(), type, x: data.room.width / 2, y: data.room.length / 2, rot: 0, w: t.w, d: t.d, h: type === "column" ? data.room.height : t.h, ...(t.elev !== undefined ? { elev: t.elev } : {}) }
    change({ ...data, items: [...data.items, it] })
    setSelected(it.id)
  }
  const addZone = () => {
    if (!data) return
    const z: Zone = { id: uid(), name: "Новая зона", x: data.room.width / 2 - 1.5, y: data.room.length / 2 - 1, w: 3, d: 2, color: "#8b5cf6", power: 3 }
    change({ ...data, zones: [...data.zones, z] })
    setShowZones(true)
    setSelected(z.id)
  }

  // Клавиши: Delete — удалить, R — повернуть, стрелки — сдвинуть, Ctrl+Z — отменить, Ctrl+D — копия
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") { e.preventDefault(); redo(); return }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") { e.preventDefault(); save(); return }
      if (!selItem || mode === "walk") {
        if (selZone && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); removeSel() }
        return
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSel() }
      else if (e.code === "KeyR") { e.preventDefault(); patchItem(selItem.id, { rot: (selItem.rot + (e.shiftKey ? 15 : 90)) % 360 }) }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyD") { e.preventDefault(); duplicate() }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault()
        const s = e.shiftKey ? 0.5 : 0.05
        const dx = e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0
        const dy = e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0
        patchItem(selItem.id, { x: Math.round((selItem.x + dx) * 100) / 100, y: Math.round((selItem.y + dy) * 100) / 100 })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // Не потерять несохранённое при уходе со страницы
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = "" } }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  const save = async () => {
    if (!data || !curId) return
    setBusy("save")
    try {
      await api(`/layouts/${curId}`, "POST", { data, name })
      setSavedJson(JSON.stringify(data))
      setLayouts((l) => l.map((x) => (x.id === curId ? { ...x, name, items: data.items.length } : x)))
      toast.success("Расстановка сохранена")
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const switchTo = async (id: string) => {
    if (dirty && !window.confirm("Есть несохранённые изменения. Открыть другой вариант без сохранения?")) return
    await open(id).catch((e: Error) => toast.error(e.message))
  }
  const createVariant = async (copy: boolean) => {
    const n = window.prompt(copy ? "Название копии" : "Название нового варианта", copy ? `${name} — копия` : "Новый вариант")
    if (!n) return
    setBusy("new")
    try {
      const base = copy && data ? data : { ...draftLayout(), items: [], zones: [], room: data?.room ?? draftLayout().room }
      const { layout } = await api<{ layout: { id: string } }>("/layouts", "POST", { name: n, data: base })
      await loadList(layout.id)
      toast.success("Вариант создан")
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const makeCurrent = async () => {
    if (!curId) return
    await api(`/layouts/${curId}`, "POST", { is_current: true }).then(() => loadList(curId)).then(() => toast.success("Отмечено как текущая расстановка магазина")).catch((e: Error) => toast.error(e.message))
  }
  const remove = async () => {
    if (!curId || !window.confirm(`Удалить вариант «${name}»?`)) return
    await api(`/layouts/${curId}`, "DELETE").then(() => loadList()).catch((e: Error) => toast.error(e.message))
  }
  const snapshot = () => {
    const url = sceneRef.current?.snapshot()
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = `${name || "зал"}.png`
    a.click()
  }
  const onBackground = (f: File | undefined) => {
    if (!f || !data) return
    const img = new Image()
    img.onload = () => {
      // Уменьшаем до 1600 px — подложка хранится вместе с расстановкой
      const k = Math.min(1, 1600 / Math.max(img.width, img.height))
      const c = document.createElement("canvas")
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
      change({ ...data, background: { src: c.toDataURL("image/jpeg", 0.8), x: 0, y: 0, w: data.room.width, opacity: 0.5 } })
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(f)
  }

  const setSlots = (id: string, slots: Slot[]) => {
    if (!data) return
    const assign = { ...(data.assign ?? {}) }
    if (slots.length) assign[id] = slots
    else delete assign[id]
    change({ ...data, assign })
  }
  const runAutofill = (onlyEmpty: boolean) => {
    if (!data) return
    if (!products.length) { toast.error("Товары ещё загружаются"); return }
    const assign = autofill(data.items, data.zones, data.room, products, data.assign ?? {}, { onlyEmpty })
    change({ ...data, assign })
    const n = Object.values(assign).reduce((a, s) => a + s.length, 0)
    toast.success(`Разложено: ${n} моделей. Проверьте и сохраните — отменить можно Ctrl+Z`)
  }
  const clearAll = () => {
    if (!data || !window.confirm("Убрать все товары с незакреплённого оборудования?")) return
    const keep = Object.fromEntries(Object.entries(data.assign ?? {}).filter(([id]) => data.items.find((i) => i.id === id)?.lock))
    change({ ...data, assign: keep })
  }
  const ensure3d = async () => {
    if (view === "plan") setView("split")
    for (let i = 0; i < 50 && !sceneRef.current; i++) await new Promise((r) => setTimeout(r, 100))
    await new Promise((r) => setTimeout(r, 400))
    return !!sceneRef.current
  }
  const usedIds = useMemo(() => new Set(Object.values(data?.assign ?? {}).flat().map((s) => s.p)), [data?.assign])
  const placedCount = usedIds.size

  const totals = useMemo(() => {
    if (!data) return null
    const byType = new Map<string, number>()
    let hang = 0, shelves = 0
    for (const it of data.items) {
      byType.set(it.type, (byType.get(it.type) ?? 0) + 1)
      const c = capacity(it)
      hang += c.hang
      shelves += c.shelves
    }
    return { byType, hang, shelves }
  }, [data])

  if (!data) return <Container><Text>Загрузка…</Text></Container>
  const room = data.room
  const setRoom = (p: Partial<typeof room>) => change({ ...data, room: { ...room, ...p } })
  const setOpening = (id: string, p: Partial<Opening>) => setRoom({ openings: room.openings.map((o) => (o.id === id ? { ...o, ...p } : o)) })
  const cur = layouts.find((l) => l.id === curId)

  const planEl = <Plan data={data} selected={selected} showZones={showZones} onSelect={setSelected} onChange={change} />
  const sceneEl = <Scene3D data={data} selected={selected} clothes={clothes} zones={showZones} looks={looks} sceneRef={sceneRef}
    onSelect={setSelected} onMove={(id, x, y) => patchItem(id, { x, y })} />

  return (
    <div className="flex flex-col gap-3">
      {/* Варианты расстановки */}
      <Container className="flex flex-wrap items-center gap-3 px-6 py-4">
        <div className="mr-2">
          <Heading level="h2">Мерчендайзинг</Heading>
          <Text size="small" className="text-ui-fg-subtle">План зала, товары на оборудовании и задания консультантам.</Text>
        </div>
        <Select value={curId ?? undefined} onValueChange={switchTo}>
          <Select.Trigger className="w-64"><Select.Value /></Select.Trigger>
          <Select.Content>
            {layouts.map((l) => <Select.Item key={l.id} value={l.id}>{l.name}{l.is_current ? " ★" : ""}</Select.Item>)}
          </Select.Content>
        </Select>
        <Input size="small" className="w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название варианта" />
        {cur?.is_current ? <Badge size="2xsmall" color="green">сейчас в магазине</Badge> : <Button size="small" variant="secondary" onClick={makeCurrent}>Сделать текущей</Button>}
        <Button size="small" variant="secondary" isLoading={busy === "new"} onClick={() => createVariant(true)}>Копия</Button>
        <Button size="small" variant="secondary" onClick={() => createVariant(false)}>Новый</Button>
        {!cur?.is_current && <Button size="small" variant="transparent" onClick={remove}>Удалить</Button>}
        <div className="ml-auto flex items-center gap-2">
          <Button size="small" variant="transparent" disabled={!history.current.length} onClick={undo} title="Ctrl+Z">Отменить</Button>
          <Button size="small" disabled={!dirty && name === cur?.name} isLoading={busy === "save"} onClick={save}>Сохранить</Button>
        </div>
      </Container>

      <div className="grid gap-3" style={{ gridTemplateColumns: "240px minmax(0,1fr) 280px" }}>
        {/* Слева: оборудование и помещение */}
        <Container className="flex max-h-[calc(100vh-180px)] flex-col gap-4 overflow-y-auto p-4">
          <div>
            <Text size="small" weight="plus">Добавить на план</Text>
            <Text size="xsmall" className="text-ui-fg-subtle">Появится в центре зала — перетащите на место</Text>
          </div>
          {GROUPS.map((g) => (
            <div key={g} className="flex flex-col gap-1">
              <Text size="xsmall" className="flex items-center gap-1.5 text-ui-fg-subtle"><span className="inline-block h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[g] }} />{GROUP_NAME[g]}</Text>
              {CATALOG.filter((c) => c.group === g).map((c) => (
                <button key={c.type} type="button" onClick={() => addItem(c.type)} title={c.hint}
                  className="rounded-md px-2 py-1 text-left text-sm hover:bg-ui-bg-base-hover">{c.name}</button>
              ))}
            </div>
          ))}
          <Button size="small" variant="secondary" onClick={addZone}>Добавить зону</Button>

          <div className="flex flex-col gap-2 border-t border-ui-border-base pt-3">
            <Text size="small" weight="plus">Помещение</Text>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Длина (по горизонтали)" value={room.width} onChange={(v) => setRoom({ width: v })} min={2} />
              <NumField label="Ширина (по вертикали)" value={room.length} onChange={(v) => setRoom({ length: v })} min={2} />
              <NumField label="Высота в коньке" value={room.height} onChange={(v) => setRoom({ height: v })} min={2} />
              <NumField label="Высота стен до ската" value={room.eave ?? room.height} onChange={(v) => setRoom({ eave: Math.min(v, room.height) })} min={2} />
            </div>
            {(["top", "right", "bottom", "left"] as WallSide[]).map((s) => (
              <div key={s} className="flex items-center justify-between gap-2">
                <Text size="xsmall" className="text-ui-fg-subtle">{WALL_NAME[s]} стена</Text>
                <Select size="small" value={room.walls[s]} onValueChange={(v) => setRoom({ walls: { ...room.walls, [s]: v as WallFinish } })}>
                  <Select.Trigger className="w-32"><Select.Value /></Select.Trigger>
                  <Select.Content>{(Object.keys(FINISH_NAME) as WallFinish[]).map((f) => <Select.Item key={f} value={f}>{FINISH_NAME[f]}</Select.Item>)}</Select.Content>
                </Select>
              </div>
            ))}
            <Text size="xsmall" weight="plus" className="pt-1">Двери и окна</Text>
            {room.openings.map((o) => (
              <div key={o.id} className="flex flex-col gap-1 rounded-md border border-ui-border-base p-2">
                <div className="flex items-center gap-1">
                  <Select size="small" value={o.kind} onValueChange={(v) => setOpening(o.id, { kind: v as Opening["kind"] })}>
                    <Select.Trigger className="w-28"><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="door">Вход</Select.Item><Select.Item value="window">Окно</Select.Item><Select.Item value="showcase">Витрина</Select.Item>
                    </Select.Content>
                  </Select>
                  <Select size="small" value={o.wall} onValueChange={(v) => setOpening(o.id, { wall: v as WallSide })}>
                    <Select.Trigger className="w-28"><Select.Value /></Select.Trigger>
                    <Select.Content>{(Object.keys(WALL_NAME) as WallSide[]).map((s) => <Select.Item key={s} value={s}>{WALL_NAME[s]}</Select.Item>)}</Select.Content>
                  </Select>
                  <IconButton size="2xsmall" variant="transparent" onClick={() => setRoom({ openings: room.openings.filter((x) => x.id !== o.id) })}><Trash /></IconButton>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <NumField label="От угла" value={o.offset} onChange={(v) => setOpening(o.id, { offset: v })} />
                  <NumField label="Ширина" value={o.width} onChange={(v) => setOpening(o.id, { width: v })} min={0.3} />
                </div>
              </div>
            ))}
            <Button size="small" variant="transparent" onClick={() => setRoom({ openings: [...room.openings, { id: uid(), kind: "window", wall: "top", offset: 1, width: 1.2 }] })}>+ Дверь или окно</Button>

            <Text size="xsmall" weight="plus" className="pt-1">Подложка (план, чертёж)</Text>
            <input type="file" accept="image/*" className="text-xs" onChange={(e) => onBackground(e.target.files?.[0])} />
            {data.background && (
              <div className="grid grid-cols-2 gap-1">
                <NumField label="Ширина подложки" value={data.background.w} onChange={(v) => change({ ...data, background: { ...data.background!, w: v } })} min={1} />
                <NumField label="Прозрачность" value={data.background.opacity} step={0.05} suffix="" onChange={(v) => change({ ...data, background: { ...data.background!, opacity: Math.min(1, v) } })} />
                <NumField label="Сдвиг вправо" value={data.background.x} onChange={(v) => change({ ...data, background: { ...data.background!, x: v } })} min={-50} />
                <NumField label="Сдвиг вниз" value={data.background.y} onChange={(v) => change({ ...data, background: { ...data.background!, y: v } })} min={-50} />
                <Button size="small" variant="transparent" onClick={() => change({ ...data, background: null })}>Убрать подложку</Button>
              </div>
            )}
          </div>
        </Container>

        {/* Центр: план и 3D */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {([["split", "План + 3D"], ["plan", "План"], ["3d", "3D"]] as const).map(([v, l]) => (
              <Button key={v} size="small" variant={view === v ? "primary" : "secondary"} onClick={() => setView(v)}>{l}</Button>
            ))}
            <div className="mx-2 h-5 w-px bg-ui-border-base" />
            <div className="flex items-center gap-2"><Switch checked={showZones} onCheckedChange={setShowZones} /><Text size="small">Зоны</Text></div>
            <div className="mx-2 h-5 w-px bg-ui-border-base" />
            <Button size="small" variant="secondary" disabled={!products.length} onClick={() => runAutofill(false)} title="По баллу умной сортировки, сезону и силе места; закреплённое не трогает">Разложить товары</Button>
            <Button size="small" variant="transparent" disabled={!products.length} onClick={() => runAutofill(true)} title="Заполнить только пустое оборудование">Дополнить пустое</Button>
            {placedCount > 0 && <Button size="small" variant="transparent" onClick={clearAll}>Убрать товары</Button>}
            {view !== "plan" && <>
              <div className="flex items-center gap-2" title="Пример вещей на пустом оборудовании; разложенные товары видны всегда"><Switch checked={clothes} onCheckedChange={setClothes} /><Text size="small">Примеры на пустом</Text></div>
              <div className="mx-2 h-5 w-px bg-ui-border-base" />
              <Button size="small" variant={mode === "orbit" ? "primary" : "secondary"} onClick={() => { setMode("orbit"); sceneRef.current?.setMode("orbit") }}>Обзор</Button>
              <Button size="small" variant={mode === "walk" ? "primary" : "secondary"} onClick={() => { setMode("walk"); sceneRef.current?.setMode("walk") }}>Пройтись по залу</Button>
              {mode === "orbit" && (["corner", "top", "entrance"] as CameraPreset[]).map((p) => (
                <Button key={p} size="small" variant="transparent" onClick={() => sceneRef.current?.preset(p)}>{p === "corner" ? "Общий вид" : p === "top" ? "Сверху" : "От входа"}</Button>
              ))}
              <Button size="small" variant="secondary" onClick={snapshot}>Снимок</Button>
            </>}
          </div>
          <div className={view === "split" ? "grid grid-rows-2 gap-2" : ""} style={{ height: "calc(100vh - 230px)", minHeight: 520 }}>
            {view !== "3d" && <Container className="h-full overflow-hidden p-2">{planEl}</Container>}
            {view !== "plan" && <div className="h-full">{sceneEl}</div>}
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {mode === "walk" && view !== "plan"
              ? "Обход зала: зажмите мышку и ведите — поворот головы; W/S или ↑/↓ — вперёд-назад, A/D — шаг в сторону, ←/→ — поворот, колесо — шаги."
              : "Перетаскивайте оборудование на плане или в 3D. R — повернуть на 90° (Shift+R — на 15°), стрелки — сдвиг на 5 см (с Shift — 50 см), Delete — удалить, Ctrl+D — копия, Ctrl+Z — отменить. В 3D: вращение — левой кнопкой по пустому месту, сдвиг вида — правой, приближение — колесом."}
          </Text>
        </div>

        {/* Справа: свойства выбранного и итоги */}
        <Container className="flex max-h-[calc(100vh-180px)] flex-col gap-3 overflow-y-auto p-4">
          {selItem ? (() => {
            const t = typeOf(selItem.type)
            const cap = capacity(selItem)
            const { hx, hy } = extents(selItem)
            return (
              <>
                <div>
                  <Text size="small" weight="plus">{t.name}</Text>
                  {t.hint && <Text size="xsmall" className="text-ui-fg-subtle">{t.hint}</Text>}
                </div>
                <Select size="small" value={selItem.type} onValueChange={(v) => {
                  const nt = typeOf(v)
                  patchItem(selItem.id, { type: v, w: nt.w, d: nt.d, h: nt.h, elev: nt.elev })
                }}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>{CATALOG.map((c) => <Select.Item key={c.type} value={c.type}>{c.name}</Select.Item>)}</Select.Content>
                </Select>
                <div className="flex flex-col gap-1">
                  <Label size="xsmall" className="text-ui-fg-subtle">Подпись на плане</Label>
                  <Input size="small" value={selItem.label ?? ""} placeholder="Например: «Стойка C.P. Company»" onChange={(e) => patchItem(selItem.id, { label: e.target.value || undefined })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="Длина" value={selItem.w} onChange={(v) => patchItem(selItem.id, { w: Math.max(0.05, v) })} />
                  <NumField label="Глубина" value={selItem.d} onChange={(v) => patchItem(selItem.id, { d: Math.max(0.02, v) })} />
                  <NumField label="Высота" value={selItem.h} onChange={(v) => patchItem(selItem.id, { h: Math.max(0.02, v) })} />
                </div>
                {selItem.elev !== undefined && <NumField label="Высота крепления от пола" value={selItem.elev} onChange={(v) => patchItem(selItem.id, { elev: v })} />}
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="От левой стены (центр)" value={selItem.x} onChange={(v) => patchItem(selItem.id, { x: v })} />
                  <NumField label="От верхней стены (центр)" value={selItem.y} onChange={(v) => patchItem(selItem.id, { y: v })} />
                </div>
                <div className="flex items-end gap-2">
                  <NumField label="Поворот" value={selItem.rot} step={1} suffix="°" onChange={(v) => patchItem(selItem.id, { rot: ((v % 360) + 360) % 360 })} />
                  <Button size="small" variant="secondary" onClick={() => patchItem(selItem.id, { rot: (selItem.rot + 270) % 360 })}>↺</Button>
                  <Button size="small" variant="secondary" onClick={() => patchItem(selItem.id, { rot: (selItem.rot + 90) % 360 })}>↻</Button>
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Края: от {num(selItem.x - hx)} до {num(selItem.x + hx)} м по горизонтали, от {num(selItem.y - hy)} до {num(selItem.y + hy)} м по вертикали.
                </Text>
                {(cap.hang > 0 || cap.shelves > 0) && (
                  <div className="rounded-md bg-ui-bg-subtle p-2">
                    <Text size="xsmall">Вместимость: {cap.hang > 0 ? `≈ ${cap.hang} вещей на вешалках` : ""}{cap.hang > 0 && cap.shelves > 0 ? ", " : ""}{cap.shelves > 0 ? `${cap.shelves} ${cap.shelves === 1 ? "полка" : cap.shelves < 5 ? "полки" : "полок"}` : ""}</Text>
                  </div>
                )}
                <EquipProducts item={selItem} slots={data.assign?.[selItem.id] ?? []} products={pmap} used={usedIds}
                  onSlots={(sl) => setSlots(selItem.id, sl)} onItem={(p) => patchItem(selItem.id, p)} />
                <div className="flex flex-col gap-1">
                  <Label size="xsmall" className="text-ui-fg-subtle">Заметка</Label>
                  <Textarea rows={2} value={selItem.note ?? ""} onChange={(e) => patchItem(selItem.id, { note: e.target.value || undefined })} />
                </div>
                <div className="flex gap-2">
                  <Button size="small" variant="secondary" onClick={duplicate}>Копия</Button>
                  <Button size="small" variant="danger" onClick={removeSel}>Удалить</Button>
                </div>
              </>
            )
          })() : selZone ? (
            <>
              <Text size="small" weight="plus">Зона</Text>
              <Input size="small" value={selZone.name} onChange={(e) => patchZone(selZone.id, { name: e.target.value })} />
              <div className="flex flex-col gap-1">
                <Label size="xsmall" className="text-ui-fg-subtle">Сила места (насколько заметно покупателю)</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((p) => (
                    <button key={p} type="button" onClick={() => patchZone(selZone.id, { power: p })}
                      className={`h-8 w-8 rounded-md border text-sm ${selZone.power >= p ? "border-amber-400 bg-amber-100 text-amber-700" : "border-ui-border-base text-ui-fg-muted"}`}>★</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#71717a"].map((c) => (
                  <button key={c} type="button" onClick={() => patchZone(selZone.id, { color: c })} className={`h-6 w-6 rounded-full border-2 ${selZone.color === c ? "border-ui-fg-base" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="Ширина" value={selZone.w} onChange={(v) => patchZone(selZone.id, { w: Math.max(0.3, v) })} />
                <NumField label="Глубина" value={selZone.d} onChange={(v) => patchZone(selZone.id, { d: Math.max(0.3, v) })} />
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">Зоны пригодятся для раскладки: в сильные места система будет ставить самое продающее и сезонное.</Text>
              <Button size="small" variant="danger" onClick={removeSel}>Удалить зону</Button>
            </>
          ) : (
            <Text size="small" className="text-ui-fg-subtle">Нажмите на оборудование или зону — здесь появятся размеры и настройки.</Text>
          )}

          {totals && (
            <div className="mt-2 flex flex-col gap-1 border-t border-ui-border-base pt-3">
              <Text size="small" weight="plus">В зале</Text>
              <Text size="xsmall">≈ {totals.hang} вещей на вешалках · {totals.shelves} полок</Text>
              <Text size="xsmall">Разложено моделей: {placedCount} из {products.length} в наличии</Text>
              {[...totals.byType.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <div key={t} className="flex justify-between text-xs text-ui-fg-subtle"><span>{typeOf(t).name}</span><span>{n}</span></div>
              ))}
            </div>
          )}
        </Container>
      </div>
      {curId && <TasksBlock layoutId={curId} layoutName={name} isCurrent={!!cur?.is_current} data={data} dirty={dirty} sceneRef={sceneRef} ensure3d={ensure3d} />}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Мерчендайзинг",
  icon: BuildingStorefront,
})

export default MerchPage
