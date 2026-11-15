import { useEffect, useRef, useState } from "react"
import { ZONE_ROLE_NAME } from "../../../lib/merch/autofill"
import { GROUP_COLOR, Item, LayoutData, typeOf, WallSide, Zone } from "./catalog"

/**
 * План зала сверху (SVG, единицы — метры). Оборудование и зоны перетаскиваются мышкой,
 * у зон — уголок для изменения размера. Шаг — 1 см; у стены оборудование «прилипает» вплотную.
 */

type Props = {
  data: LayoutData
  selected: string | null
  showZones: boolean
  onSelect: (id: string | null) => void
  /** live — во время перетаскивания (без записи в историю отмены) */
  onChange: (d: LayoutData, live?: boolean) => void
  /** Оборудование с замечаниями проверки — обводится красным */
  warnIds?: Set<string>
}

const FINISH_COLOR: Record<string, string> = { brick: "#b4583a", white: "#d4d4d0", concrete: "#9b9a95", glass: "#9fc2d8" }
const snap = (v: number, s = 0.01) => Math.round(v / s) * s
const r2 = (v: number) => Math.round(v * 100) / 100

/** Габарит по осям с учётом поворота */
export function extents(it: Item) {
  const a = (it.rot * Math.PI) / 180
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a))
  return { hx: (it.w * c + it.d * s) / 2, hy: (it.w * s + it.d * c) / 2 }
}

export function Plan({ data, selected, showZones, onSelect, onChange, warnIds }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ kind: "item" | "zone" | "resize"; id: string; dx: number; dy: number; start: LayoutData } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const { room } = data
  const W = room.width, L = room.length
  const pad = 0.8

  const toM = (e: { clientX: number; clientY: number }) => {
    const el = svg.current!
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const p = toM(e)
      if (d.kind === "item") {
        const items = d.start.items.map((it) => {
          if (it.id !== d.id) return it
          let x = snap(p.x + d.dx), y = snap(p.y + d.dy)
          const { hx, hy } = extents(it)
          const stick = 0.08
          // У стены — вплотную
          if (Math.abs(x - hx) < stick) x = hx
          if (Math.abs(W - x - hx) < stick) x = W - hx
          if (Math.abs(y - hy) < stick) y = hy
          if (Math.abs(L - y - hy) < stick) y = L - hy
          return { ...it, x: r2(Math.min(W, Math.max(0, x))), y: r2(Math.min(L, Math.max(0, y))) }
        })
        onChange({ ...d.start, items }, true)
      } else {
        const zones = d.start.zones.map((z) => {
          if (z.id !== d.id) return z
          if (d.kind === "zone") return { ...z, x: r2(Math.min(W - z.w, Math.max(0, snap(p.x + d.dx)))), y: r2(Math.min(L - z.d, Math.max(0, snap(p.y + d.dy)))) }
          return { ...z, w: r2(Math.max(0.3, Math.min(W - z.x, snap(p.x - z.x)))), d: r2(Math.max(0.3, Math.min(L - z.y, snap(p.y - z.y)))) }
        })
        onChange({ ...d.start, zones }, true)
      }
    }
    const up = () => {
      if (drag.current) {
        drag.current = null
        onChange(dataRef.current, false)
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up) }
  })
  const dataRef = useRef(data)
  dataRef.current = data

  const startItem = (e: React.PointerEvent, it: Item) => {
    e.stopPropagation()
    onSelect(it.id)
    const p = toM(e)
    drag.current = { kind: "item", id: it.id, dx: it.x - p.x, dy: it.y - p.y, start: data }
  }
  const startZone = (e: React.PointerEvent, z: Zone, resize = false) => {
    e.stopPropagation()
    onSelect(z.id)
    const p = toM(e)
    drag.current = { kind: resize ? "resize" : "zone", id: z.id, dx: z.x - p.x, dy: z.y - p.y, start: data }
  }

  const wallLine = (side: WallSide) => {
    const T = 0.15
    const color = FINISH_COLOR[room.walls[side]]
    const segs: [number, number][] = []
    const len = side === "top" || side === "bottom" ? W : L
    const ops = room.openings.filter((o) => o.wall === side).sort((a, b) => a.offset - b.offset)
    let cur = 0
    for (const o of ops) { segs.push([cur, o.offset]); cur = o.offset + o.width }
    segs.push([cur, len])
    const rect = (a: number, b: number, key: string, fill: string, thin = false) => {
      const t = thin ? 0.05 : T
      if (side === "top") return <rect key={key} x={a} y={-t} width={b - a} height={t} fill={fill} />
      if (side === "bottom") return <rect key={key} x={a} y={L} width={b - a} height={t} fill={fill} />
      if (side === "left") return <rect key={key} x={-t} y={a} width={t} height={b - a} fill={fill} />
      return <rect key={key} x={W} y={a} width={t} height={b - a} fill={fill} />
    }
    return (
      <g key={side}>
        {segs.filter(([a, b]) => b > a).map(([a, b], i) => rect(a, b, `${side}${i}`, color))}
        {ops.map((o) => o.kind === "door"
          ? <g key={o.id}>
              {rect(o.offset, o.offset + o.width, `${o.id}d`, "#16a34a", true)}
              <text {...doorLabel(side, o.offset + o.width / 2, W, L)} fontSize={0.24} textAnchor="middle" fill="#16a34a" fontWeight={600}>вход</text>
            </g>
          : rect(o.offset, o.offset + o.width, o.id, "#60a5fa", true))}
      </g>
    )
  }

  const bg = data.background
  return (
    <svg ref={svg} viewBox={`${-pad} ${-pad} ${W + pad * 2} ${L + pad * 2}`} className="h-full w-full select-none" style={{ touchAction: "none" }}
      onPointerDown={() => onSelect(null)}>
      <rect x={-pad} y={-pad} width={W + pad * 2} height={L + pad * 2} fill="var(--bg-subtle, #f4f4f5)" />
      <rect x={0} y={0} width={W} height={L} fill="#e7e6e2" />
      {bg?.src && <image href={bg.src} x={bg.x} y={bg.y} width={bg.w} opacity={bg.opacity} preserveAspectRatio="xMinYMin meet" />}
      {/* Сетка через 1 м */}
      {Array.from({ length: Math.floor(W) }, (_, i) => <line key={`gx${i}`} x1={i + 1} y1={0} x2={i + 1} y2={L} stroke="#000" strokeOpacity={0.06} strokeWidth={0.015} />)}
      {Array.from({ length: Math.floor(L) }, (_, i) => <line key={`gy${i}`} x1={0} y1={i + 1} x2={W} y2={i + 1} stroke="#000" strokeOpacity={0.06} strokeWidth={0.015} />)}
      {(["top", "right", "bottom", "left"] as WallSide[]).map(wallLine)}
      {/* Размеры зала */}
      <text x={W / 2} y={-0.35} fontSize={0.26} textAnchor="middle" fill="#71717a">{String(W).replace(".", ",")} м</text>
      <text x={-0.35} y={L / 2} fontSize={0.26} textAnchor="middle" fill="#71717a" transform={`rotate(-90 ${-0.35} ${L / 2})`}>{String(L).replace(".", ",")} м</text>

      {showZones && data.zones.map((z) => (
        <g key={z.id}>
          <rect x={z.x} y={z.y} width={z.w} height={z.d} fill={z.color} fillOpacity={0.14} stroke={z.color} strokeOpacity={selected === z.id ? 1 : 0.6}
            strokeWidth={selected === z.id ? 0.05 : 0.025} strokeDasharray="0.12 0.08" style={{ cursor: "move" }} onPointerDown={(e) => startZone(e, z)} />
          <text x={z.x + 0.12} y={z.y + 0.32} fontSize={0.24} fill={z.color} fontWeight={600} pointerEvents="none">{z.name} · {"★".repeat(z.power)}{z.role ? ` · ${ZONE_ROLE_NAME[z.role]}` : ""}{z.brands?.length ? ` · ${z.brands.join(", ")}` : ""}</text>
          {selected === z.id && <rect x={z.x + z.w - 0.12} y={z.y + z.d - 0.12} width={0.24} height={0.24} fill="#fff" stroke={z.color} strokeWidth={0.03} style={{ cursor: "nwse-resize" }} onPointerDown={(e) => startZone(e, z, true)} />}
        </g>
      ))}

      {[...data.items].sort((a, b) => (a.type === "track" ? 1 : 0) - (b.type === "track" ? 1 : 0)).map((it) => {
        const t = typeOf(it.type)
        const sel = selected === it.id
        const col = it.type === "entrance" ? "#16a34a" : it.type === "window_item" ? "#3b82f6" : it.type === "block" ? "#52525b" : GROUP_COLOR[t.group]
        const track = it.type === "track"
        const warn = warnIds?.has(it.id)
        return (
          <g key={it.id} transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`} style={{ cursor: "move" }}
            onPointerDown={(e) => startItem(e, it)} onPointerEnter={() => setHover(it.id)} onPointerLeave={() => setHover(null)}>
            {track ? (
              <line x1={-it.w / 2} y1={0} x2={it.w / 2} y2={0} stroke="#18181b" strokeOpacity={sel ? 0.9 : 0.35} strokeWidth={sel ? 0.08 : 0.04} strokeDasharray="0.25 0.15" />
            ) : t.round ? (
              <ellipse rx={it.w / 2} ry={it.d / 2} fill={col} fillOpacity={sel ? 0.55 : 0.32} stroke={sel ? "#1d4ed8" : warn ? "#dc2626" : col} strokeWidth={sel ? 0.06 : warn ? 0.05 : 0.025} />
            ) : (
              <rect x={-it.w / 2} y={-it.d / 2} width={it.w} height={it.d} rx={0.03} fill={col} fillOpacity={sel ? 0.55 : 0.32} stroke={sel ? "#1d4ed8" : warn ? "#dc2626" : col} strokeWidth={sel ? 0.06 : warn ? 0.05 : 0.025} strokeDasharray={warn && !sel ? "0.08 0.05" : undefined} />
            )}
            {/* Штанга — линией, чтобы было видно, куда смотрят вещи */}
            {t.hangPerM && !t.round && <line x1={-it.w / 2 + 0.05} y1={0} x2={it.w / 2 - 0.05} y2={0} stroke="#1e3a8a" strokeOpacity={0.55} strokeWidth={0.02} />}
            {/* Лицевая сторона у пристенного */}
            {t.wall && !track && <line x1={-it.w / 2} y1={it.d / 2} x2={it.w / 2} y2={it.d / 2} stroke="#111" strokeOpacity={0.5} strokeWidth={0.03} />}
            {(sel || hover === it.id || it.label || it.gender || it.mix || it.brands?.length) && !track && (
              <text y={-it.d / 2 - 0.08} fontSize={0.2} textAnchor="middle" fill="#27272a" transform={it.rot > 90 && it.rot < 270 ? "rotate(180)" : undefined} pointerEvents="none">
                {it.label || t.name}{it.gender === "women" ? " · жен." : it.gender === "men" ? " · муж." : ""}{it.mix ? " · микс" : it.brands?.length ? ` · ${it.brands.join(", ")}` : ""}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function doorLabel(side: WallSide, mid: number, W: number, L: number) {
  if (side === "top") return { x: mid, y: -0.3 }
  if (side === "bottom") return { x: mid, y: L + 0.45 }
  if (side === "left") return { x: -0.45, y: mid }
  return { x: W + 0.45, y: mid }
}
