/**
 * Проверка расстановки зала (ТЗ, п. 3.10): пересечения, выход за стены, узкие проходы, перекрытый вход,
 * высокое оборудование у входа, подход к примерочным и кассе. Только предупреждения — ничего не запрещает.
 */

export type CheckItem = { id: string; type: string; x: number; y: number; w: number; d: number; h: number; rot: number; elev?: number; label?: string }
export type CheckRoom = { width: number; length: number; openings: { kind: string; wall: string; offset: number; width: number }[] }
export type Warning = { level: "error" | "warn"; text: string; ids: string[] }
export type CheckOpts = { aisle?: number; mainAisle?: number; /** Ширина одежды на плечиках, м: вещи на штанге выступают за стойку */ hangDepth?: number }

type Pt = { x: number; y: number }

/** Не мешают проходу: висят на стене или под потолком */
const AIRBORNE = new Set(["track", "wall_shelf", "wall_shelf_s", "grid_panel", "mirror", "entrance", "window_item"])
/** Конструкция помещения — проходы до неё не считаем */
const STRUCTURE = new Set(["column", "partition", "block"])
/** Штанги: одежда на плечиках шире самой стойки */
const RAILS = new Set(["wall_system", "rack_base", "rack_pipe", "rack_pipe_double", "round_rack"])

export function corners(it: CheckItem): Pt[] {
  const a = (it.rot * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const lx = (sx * it.w) / 2, ly = (sy * it.d) / 2
    return { x: it.x + lx * c - ly * s, y: it.y + lx * s + ly * c }
  })
}

/** Пересекаются ли выпуклые многоугольники (теорема о разделяющей оси) */
function overlap(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length]
      const nx = q.y - p.y, ny = p.x - q.x
      const proj = (pts: Pt[]) => pts.map((v) => v.x * nx + v.y * ny)
      const pa = proj(a), pb = proj(b)
      // Касание (до 1 см заступа) — не пересечение: стойка вплотную к стене, части ресепшена встык
      const tol = 0.01 * Math.hypot(nx, ny)
      if (Math.max(...pa) <= Math.min(...pb) + tol || Math.max(...pb) <= Math.min(...pa) + tol) return false
    }
  }
  return true
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/** Расстояние между многоугольниками (0 — касаются или пересекаются) */
export function gap(a: Pt[], b: Pt[]): number {
  if (overlap(a, b)) return 0
  let d = Infinity
  for (const [P, Q] of [[a, b], [b, a]]) {
    for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, segDist(p, Q[i], Q[(i + 1) % Q.length]))
  }
  return d
}

const nameOf = (it: CheckItem, names: Record<string, string>) => it.label || names[it.type] || it.type
const cm = (m: number) => `${Math.round(m * 100)} см`

export function checkLayout(items: CheckItem[], room: CheckRoom, names: Record<string, string> = {}, opts: CheckOpts = {}): Warning[] {
  const aisle = opts.aisle ?? 0.8
  const out: Warning[] = []
  const floor = items.filter((i) => !AIRBORNE.has(i.type))
  const hd = opts.hangDepth ?? 0.48
  // Для проходов стойка — по ширине одежды на плечиках (двойная — по двум рядам)
  const footprint = (i: CheckItem) => RAILS.has(i.type) ? { ...i, d: Math.max(i.d, i.type === "rack_pipe_double" ? i.d / 2 + hd : hd), w: i.type === "round_rack" ? Math.max(i.w, i.w + hd) : i.w } : i
  const poly = new Map(items.map((i) => [i.id, corners(footprint(i))]))

  // За стенами
  for (const it of items) {
    const c = poly.get(it.id)!
    if (c.some((p) => p.x < -0.02 || p.y < -0.02 || p.x > room.width + 0.02 || p.y > room.length + 0.02)) {
      out.push({ level: "error", text: `${nameOf(it, names)} выходит за стену`, ids: [it.id] })
    }
  }
  // Пересечения и узкие проходы
  for (let i = 0; i < floor.length; i++) {
    for (let j = i + 1; j < floor.length; j++) {
      const a = floor[i], b = floor[j]
      const pa = poly.get(a.id)!, pb = poly.get(b.id)!
      // Касание (вплотную) — не ошибка; ошибка — когда заходят друг на друга
      const g = overlap(pa, pb) ? 0 : Math.max(0.001, gap(pa, pb))
      if (g === 0) {
        out.push({ level: "error", text: `${nameOf(a, names)} и ${nameOf(b, names)} стоят друг на друге`, ids: [a.id, b.id] })
      } else if (g < aisle && !STRUCTURE.has(a.type) && !STRUCTURE.has(b.type)) {
        // Колонны и перегородка — как стены: к ним можно ставить вплотную
        // Вплотную (до 10 см) — значит, поставлены «блоком», это не проход
        if (g < 0.1) continue
        out.push({ level: "warn", text: `Узкий проход ${cm(g)} между «${nameOf(a, names)}» и «${nameOf(b, names)}» — нужно от ${cm(aisle)}`, ids: [a.id, b.id] })
      }
    }
  }
  // Вход: перед дверью свободно 1,2 м; высокое (выше 1,4 м) в первых 3 м закрывает обзор зала
  const doors: Pt[][] = room.openings.filter((o) => o.kind === "door").map((door) => {
    const mid = door.offset + door.width / 2
    const pt = door.wall === "top" ? { x: mid, y: 0 } : door.wall === "bottom" ? { x: mid, y: room.length } : door.wall === "left" ? { x: 0, y: mid } : { x: room.width, y: mid }
    return door.wall === "top" || door.wall === "bottom"
      ? [{ x: door.offset, y: pt.y }, { x: door.offset + door.width, y: pt.y }]
      : [{ x: pt.x, y: door.offset }, { x: pt.x, y: door.offset + door.width }]
  })
  // Вход, поставленный элементом «Вход» на любую стену: его лицевая кромка
  for (const e of items.filter((i) => i.type === "entrance")) { const c = corners(e); doors.push([c[2], c[3]]) }
  for (const doorPoly of doors) {
    for (const it of floor) {
      const c = poly.get(it.id)!
      const d = Math.min(...c.map((p) => segDist(p, doorPoly[0], doorPoly[1])), ...doorPoly.map((p) => Math.min(...c.map((q, k) => segDist(p, q, c[(k + 1) % 4])))))
      if (d < 1.2) out.push({ level: "error", text: `«${nameOf(it, names)}» перекрывает вход (${cm(d)} от двери, нужно 120 см)`, ids: [it.id] })
      else if (d < 3 && it.h > 1.4 && !STRUCTURE.has(it.type)) out.push({ level: "warn", text: `«${nameOf(it, names)}» высотой ${cm(it.h)} в ${cm(d)} от входа закрывает обзор зала — у входа лучше оборудование до 140 см`, ids: [it.id] })
    }
  }
  // Подход к примерочным и кассе: спереди 90 см свободно
  for (const it of items.filter((i) => i.type === "fitting" || i.type === "cash")) {
    const a = (it.rot * Math.PI) / 180
    // Перед — сторона +d/2 (для кассы — со стороны покупателя), зона 90 см
    const zone: CheckItem = { ...it, id: `${it.id}-front`, x: it.x - Math.sin(a) * (it.d / 2 + 0.45), y: it.y + Math.cos(a) * (it.d / 2 + 0.45), d: 0.88, w: Math.min(it.w, 1) }
    for (const o of floor) {
      if (o.id === it.id || o.type === "fitting") continue
      if (gap(corners(zone), poly.get(o.id)!) === 0) out.push({ level: "warn", text: `«${nameOf(o, names)}» мешает подойти к ${it.type === "fitting" ? "примерочной" : "кассе"}`, ids: [o.id, it.id] })
    }
  }
  return out
}
