import * as THREE from "three"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

/**
 * Вещи для 3D: объёмные модели, собранные кодом (без файлов моделей). Каждая вещь — несколько частей:
 * ткань красится в цвет товара, вешалка, молния, подошва — свои материалы.
 *
 * Система координат вещи на штанге: начало — точка под крючком (на 6 см ниже штанги), вещь висит вниз (−y),
 * ширина плечиков — по z, толщина — по x (штанга идёт вдоль x). Вещи на полке: длина по x, глубина по z,
 * начало — в центре.
 */

export type GarmentKind =
  | "tee" | "longsleeve" | "shirt" | "hoodie" | "sweater" | "jacket" | "puffer" | "pants" | "shorts"
  | "fold" | "shoe" | "bag" | "cap" | "worn_top" | "worn_tee" | "worn_bottom"
export type PartMat = "cloth" | "knit" | "nylon" | "hanger" | "metal" | "sole" | "button"
export type GarmentPart = { geo: THREE.BufferGeometry; mat: PartMat; tint: boolean }

type P2 = [number, number]
type SweepOpts = {
  /** Ось детали: точки (z, y) */
  path: P2[]
  /** Полуширина (по z) и полутолщина (по x) вдоль оси, t от 0 до 1 */
  w: (t: number) => number
  th: (t: number) => number
  x0?: number
  seg?: number
  rows?: number
  /** Складки: глубина в зависимости от t */
  fold?: (t: number) => number
  foldFreq?: number
  /** Рельеф по окружности (резинка, стёжка): множитель толщины */
  rib?: (phi: number, t: number) => number
  cap?: boolean
  seed?: number
}

/** Деталь-«рукав»: эллипс в сечении, протянутый вдоль оси. Закрывается с концов */
function sweep(o: SweepOpts): THREE.BufferGeometry {
  const seg = o.seg ?? 20, rows = o.rows ?? 14
  // Пересэмплирование оси по длине
  const lens = [0]
  for (let i = 1; i < o.path.length; i++) lens.push(lens[i - 1] + Math.hypot(o.path[i][0] - o.path[i - 1][0], o.path[i][1] - o.path[i - 1][1]))
  const total = lens[lens.length - 1] || 1
  const at = (s: number): P2 => {
    const d = s * total
    let i = 1
    while (i < lens.length - 1 && lens[i] < d) i++
    const k = (d - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1)
    return [o.path[i - 1][0] + (o.path[i][0] - o.path[i - 1][0]) * k, o.path[i - 1][1] + (o.path[i][1] - o.path[i - 1][1]) * k]
  }
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  const x0 = o.x0 ?? 0
  const ph = (o.seed ?? 0.37) * 10
  for (let r = 0; r <= rows; r++) {
    const t = r / rows
    const c = at(t), a = at(Math.max(0, t - 0.01)), b = at(Math.min(1, t + 0.01))
    let dz = b[0] - a[0], dy = b[1] - a[1]
    const l = Math.hypot(dz, dy) || 1
    dz /= l; dy /= l
    // Нормаль в плоскости вещи — направление ширины
    const nz = -dy, ny = dz
    const W = o.w(t), T = o.th(t), F = o.fold?.(t) ?? 0
    for (let s = 0; s <= seg; s++) {
      const phi = (s / seg) * Math.PI * 2
      const cw = Math.cos(phi), sw = Math.sin(phi)
      const rib = o.rib?.(phi, t) ?? 1
      // Складки — волны поперёк ширины, сильнее к низу; на кромке (sin φ = 0) сходят на нет
      const fold = F * (0.5 + 0.5 * Math.sin(cw * (o.foldFreq ?? 7) + ph + t * 2.3))
      const x = x0 + sw * (T * rib + fold)
      pos.push(x, c[1] + ny * W * cw, c[0] + nz * W * cw)
      uv.push(s / seg, t * total)
    }
  }
  for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + seg + 1
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  if (o.cap !== false) {
    for (const r of [0, rows]) {
      const ci = pos.length / 3
      let cx = 0, cy = 0, cz = 0
      for (let s = 0; s < seg; s++) { const k = (r * (seg + 1) + s) * 3; cx += pos[k]; cy += pos[k + 1]; cz += pos[k + 2] }
      pos.push(cx / seg, cy / seg, cz / seg)
      uv.push(0.5, r === 0 ? 0 : total)
      for (let s = 0; s < seg; s++) {
        const a = r * (seg + 1) + s
        if (r === 0) idx.push(ci, a + 1, a)
        else idx.push(ci, a, a + 1)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Привести к общему виду для склейки: индекс, position, normal, uv */
function norm(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g : g.setIndex([...Array(g.attributes.position.count).keys()])
  for (const k of Object.keys(out.attributes)) if (!["position", "normal", "uv"].includes(k)) out.deleteAttribute(k)
  if (!out.attributes.normal) out.computeVertexNormals()
  if (!out.attributes.uv) out.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2))
  return out
}
const merge = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map(norm), false)!
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)))
  return g
}
const scaled = (g: THREE.BufferGeometry, sx: number, sy: number, sz: number) => { g.scale(sx, sy, sz); return g }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
/** Трубка от точки к точке (вешалки, крючки) */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8) {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)))
  return g
}

// ── Вешалки ──

function hook() {
  // Крючок: стойка и дуга над штангой (штанга — на 6 см выше начала вещи)
  const arc = new THREE.TorusGeometry(0.022, 0.0028, 6, 20, Math.PI * 1.35)
  arc.rotateY(Math.PI / 2)
  at(arc, 0, 0.056, 0, -Math.PI * 0.2)
  return merge([rod(new THREE.Vector3(0, -0.005, 0), new THREE.Vector3(0, 0.036, -0.002), 0.003), arc])
}
function topHanger() {
  return hook()
}
function clipHanger() {
  const bar = new RoundedBoxGeometry(0.012, 0.022, 0.3, 2, 0.004)
  at(bar, 0, -0.008, 0)
  const clips = [-0.12, 0.12].map((z) => at(new RoundedBoxGeometry(0.018, 0.035, 0.028, 1, 0.004), 0, -0.03, z))
  return merge([hook(), bar, ...clips])
}

// ── Верх ──

type TopOpts = { len: number; sh: number; th: number; long: boolean; sleeveW: number; sleeveTh: number; fold?: number; rib?: SweepOpts["rib"]; hem?: boolean; quilt?: boolean; seed?: number }

function torso(o: TopOpts) {
  return sweep({
    path: [[0, -0.005], [0, -o.len]],
    // Плечи на вешалке: от горловины к плечу, дальше — почти прямо, к низу чуть уже
    w: (t) => (t < 0.12 ? lerp(0.075, o.sh, smooth(t / 0.12)) : o.sh * (1 - 0.06 * t)) * (o.hem && t > 0.93 ? 0.94 : 1),
    th: (t) => (o.th * (0.55 + 0.45 * Math.sin(Math.min(1, t * 2.2) * Math.PI / 2))) * (o.quilt ? 1 + 0.22 * Math.abs(Math.sin(t * Math.PI * 7)) : 1),
    fold: (t) => (o.fold ?? 0.006) * t,
    rib: o.rib, seed: o.seed, rows: o.quilt ? 36 : 16, seg: o.rib ? 48 : 22,
  })
}
function sleeves(o: TopOpts) {
  return [-1, 1].map((sgn) => {
    const path: P2[] = o.long
      ? [[sgn * (o.sh - o.sleeveW * 0.9), -0.075], [sgn * (o.sh + 0.005), -0.3], [sgn * (o.sh + 0.015), -Math.min(0.64, o.len - 0.04)]]
      : [[sgn * (o.sh - o.sleeveW * 0.9), -0.07], [sgn * (o.sh + 0.035), -0.24]]
    return sweep({
      path,
      w: (t) => lerp(o.sleeveW, o.sleeveW * (o.long ? 0.72 : 0.92), t) * (o.hem && o.long && t > 0.9 ? 0.85 : 1) * (t < 0.12 ? lerp(0.55, 1, smooth(t / 0.12)) : 1),
      th: (t) => lerp(o.sleeveTh, o.sleeveTh * 0.8, t) * (o.quilt ? 1 + 0.2 * Math.abs(Math.sin(t * Math.PI * 6)) : 1),
      fold: (t) => (o.fold ?? 0.006) * 0.6 * t, foldFreq: 4,
      // Рукав чуть смещён вперёд-назад от корпуса, чтобы не прорастал в него
      x0: sgn * 0.004, rib: o.rib, seed: (o.seed ?? 0.3) + sgn, rows: o.quilt ? 20 : 8, seg: o.rib ? 24 : 12,
    })
  })
}
function collar(r: number, tube: number, x = 1) {
  return scaled(new THREE.TorusGeometry(r, tube, 6, 18).rotateX(Math.PI / 2), x, 1, 1)
}

function tee(long: boolean): GarmentPart[] {
  const o: TopOpts = { len: 0.7, sh: 0.225, th: 0.016, long, sleeveW: long ? 0.055 : 0.075, sleeveTh: 0.014, fold: 0.007, seed: long ? 0.6 : 0.2 }
  const neck = at(collar(0.07, 0.007, 0.35), 0, -0.012, 0)
  return [{ geo: merge([torso(o), ...sleeves(o), neck]), mat: "cloth", tint: true }, { geo: topHanger(), mat: "hanger", tint: false }]
}

function shirt(): GarmentPart[] {
  const o: TopOpts = { len: 0.76, sh: 0.23, th: 0.016, long: true, sleeveW: 0.058, sleeveTh: 0.014, fold: 0.005, hem: true, seed: 0.45 }
  // Воротник — два уголка, планка с пуговицами спереди
  const points = [-1, 1].map((s) => at(new RoundedBoxGeometry(0.006, 0.07, 0.06, 1, 0.002), 0.02, -0.04, s * 0.04, s * 0.5))
  const stand = at(collar(0.065, 0.012, 0.4), 0, -0.006, 0)
  const placket = at(new THREE.BoxGeometry(0.004, 0.68, 0.03), 0.02, -0.4, 0)
  const buttons = [0.12, 0.25, 0.38, 0.51, 0.64].map((y) => at(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 10).rotateZ(Math.PI / 2), 0.023, -y, 0))
  return [
    { geo: merge([torso(o), ...sleeves(o), stand, ...points, placket]), mat: "cloth", tint: true },
    { geo: merge(buttons), mat: "button", tint: false },
    { geo: topHanger(), mat: "hanger", tint: false },
  ]
}

function hoodie(): GarmentPart[] {
  const o: TopOpts = { len: 0.7, sh: 0.235, th: 0.03, long: true, sleeveW: 0.068, sleeveTh: 0.026, fold: 0.008, hem: true, seed: 0.8 }
  // Капюшон лежит на спине, карман-«кенгуру» спереди
  const hood = at(scaled(new THREE.SphereGeometry(1, 12, 8), 0.035, 0.15, 0.13), -0.03, -0.13, 0)
  const pocket = at(new RoundedBoxGeometry(0.014, 0.17, 0.27, 2, 0.006), 0.034, -0.53, 0)
  const neck = at(collar(0.08, 0.016, 0.45), 0, -0.02, 0)
  const strings = [-0.03, 0.03].map((z) => rod(new THREE.Vector3(0.03, -0.03, z), new THREE.Vector3(0.036, -0.2, z * 1.3), 0.0025, 6))
  return [
    { geo: merge([torso(o), ...sleeves(o), hood, pocket, neck, ...strings]), mat: "cloth", tint: true },
    { geo: topHanger(), mat: "hanger", tint: false },
  ]
}

function sweater(): GarmentPart[] {
  // Вязка: рубчик по кругу (резинка) на манжетах и низе, косы — частые волны по корпусу
  const rib: SweepOpts["rib"] = (phi, t) => 1 + 0.07 * Math.sin(phi * 46) * (t > 0.9 ? 1.6 : 0.6)
  const o: TopOpts = { len: 0.67, sh: 0.235, th: 0.026, long: true, sleeveW: 0.065, sleeveTh: 0.022, fold: 0.007, hem: true, rib, seed: 0.15 }
  const neck = at(collar(0.075, 0.014, 0.42), 0, -0.014, 0)
  return [{ geo: merge([torso(o), ...sleeves(o), neck]), mat: "knit", tint: true }, { geo: topHanger(), mat: "hanger", tint: false }]
}

function jacket(puffer: boolean): GarmentPart[] {
  const o: TopOpts = puffer
    ? { len: 0.74, sh: 0.255, th: 0.065, long: true, sleeveW: 0.085, sleeveTh: 0.06, fold: 0.004, quilt: true, seed: 0.9 }
    : { len: 0.74, sh: 0.25, th: 0.045, long: true, sleeveW: 0.075, sleeveTh: 0.04, fold: 0.006, hem: true, seed: 0.7 }
  const neck = at(collar(0.085, puffer ? 0.03 : 0.022, 0.6), 0, -0.02, 0)
  const zipper = at(new THREE.BoxGeometry(0.005, o.len - 0.06, 0.009), o.th * 1.08, -o.len / 2 - 0.02, 0)
  const pull = at(new RoundedBoxGeometry(0.006, 0.03, 0.012, 1, 0.002), o.th * 1.1, -0.08, 0)
  const parts: THREE.BufferGeometry[] = [torso(o), ...sleeves(o), neck]
  if (!puffer) for (const s of [-1, 1]) parts.push(at(new RoundedBoxGeometry(0.01, 0.05, 0.13, 1, 0.004), o.th * 0.95, -0.5, s * 0.12))
  return [
    { geo: merge(parts), mat: puffer ? "nylon" : "cloth", tint: true },
    { geo: merge([zipper, pull]), mat: "metal", tint: false },
    { geo: topHanger(), mat: "hanger", tint: false },
  ]
}

// ── Низ ──

function bottoms(len: number, legW: number): GarmentPart[] {
  const top = -0.035
  const hips = sweep({ path: [[0, top], [0, top - 0.27]], w: (t) => lerp(0.175, 0.185, t), th: (t) => lerp(0.02, 0.03, Math.min(1, t * 2)), rows: 10, fold: (t) => 0.002 * t })
  const legs = [-1, 1].map((s) => sweep({
    path: [[s * 0.088, top - 0.22], [s * 0.095, top - len]],
    w: (t) => lerp(legW * 0.95, legW * (len > 0.6 ? 0.8 : 1.05), t), th: (t) => lerp(0.028, 0.022, t),
    fold: (t) => 0.006 * t, foldFreq: 5, seed: 0.3 + s, rows: 10, seg: 14,
  }))
  return [{ geo: merge([hips, ...legs]), mat: "cloth", tint: true }, { geo: clipHanger(), mat: "hanger", tint: false }]
}

// ── На полках ──

function folded(): GarmentPart[] {
  // Стопка: сложенная вещь со скруглённым сгибом спереди и намёком на рукава сверху
  const body = new RoundedBoxGeometry(0.3, 0.03, 0.25, 2, 0.01)
  const roll = at(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 12).rotateZ(Math.PI / 2), 0, 0, 0.122)
  const layer = at(new RoundedBoxGeometry(0.22, 0.006, 0.17, 1, 0.003), 0, 0.016, -0.01)
  return [{ geo: merge([body, roll, layer]), mat: "cloth", tint: true }]
}

function shoe(): GarmentPart[] {
  // Кроссовок: подошва и верх-«капля» от пятки к носку; начало — центр габарита 29 × 11 × 11 см, носок — к +x
  const soleTop = -0.024
  const height = (t: number) => (t < 0.25 ? lerp(0.05, 0.047, t / 0.25) : t < 0.7 ? lerp(0.047, 0.033, (t - 0.25) / 0.45) : lerp(0.033, 0.016, (t - 0.7) / 0.3))
  const upper = sweep({
    path: Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [lerp(-0.135, 0.14, t), soleTop + height(t) * 0.92] as P2 }),
    w: height, th: (t) => (t < 0.15 ? lerp(0.036, 0.046, t / 0.15) : t < 0.75 ? lerp(0.048, 0.047, t) : lerp(0.047, 0.03, (t - 0.75) / 0.25)),
    rows: 18, seg: 18,
  })
  upper.rotateY(Math.PI / 2)
  const sole = at(new RoundedBoxGeometry(0.29, 0.03, 0.105, 3, 0.012), 0, -0.039, 0)
  // Вход для ноги и шнуровка — тёмным и светлым поверх верха
  const opening = at(scaled(new THREE.SphereGeometry(1, 14, 8), 0.048, 0.006, 0.03), -0.075, soleTop + 0.086, 0)
  const laces = [0, 1, 2, 3].map((i) => at(new THREE.BoxGeometry(0.008, 0.004, 0.05), -0.025 + i * 0.022, soleTop + 0.085 - i * 0.008, 0, 0, 0, -0.3))
  return [
    { geo: upper, mat: "cloth", tint: true },
    { geo: sole, mat: "sole", tint: false },
    { geo: merge(laces), mat: "button", tint: false },
    { geo: opening, mat: "hanger", tint: false },
  ]
}

function cap(): GarmentPart[] {
  // Кепка: купол, козырёк, пуговица; козырёк — к покупателю (+z)
  const crown = scaled(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0.092, 0.085, 0.088)
  const brim = at(scaled(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI), 0.085, 0.006, 0.09), 0.06, 0.006, 0, 0, 0, -0.12)
  const btn = at(new THREE.SphereGeometry(0.009, 8, 6), 0, 0.085, 0)
  const g = merge([crown, brim, btn])
  g.rotateY(-Math.PI / 2)
  return [{ geo: g, mat: "cloth", tint: true }]
}

function bag(): GarmentPart[] {
  // Сумка: корпус, карман, ручка, пряжка; начало — центр габарита 30 × 24 × 12 см
  const body = at(new RoundedBoxGeometry(0.3, 0.2, 0.11, 3, 0.035), 0, -0.02, 0)
  const pocket = at(new RoundedBoxGeometry(0.22, 0.09, 0.02, 2, 0.008), 0, -0.06, 0.058)
  const handle = at(new THREE.TorusGeometry(0.07, 0.008, 8, 20, Math.PI), 0, 0.075, 0)
  return [
    { geo: merge([body, pocket, handle]), mat: "cloth", tint: true },
    { geo: at(new RoundedBoxGeometry(0.035, 0.022, 0.006, 1, 0.002), 0, -0.035, 0.07), mat: "metal", tint: false },
  ]
}

// ── Манекен ──

/** Тело манекена: смотрит вдоль +z, стоит на y = 0 (ступни на подставке) */
export function mannequinBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    sweep({ path: [[0, 1.47], [0, 1.3], [0, 1.1], [0, 0.92]], w: (t) => (t < 0.15 ? lerp(0.13, 0.2, t / 0.15) : t < 0.6 ? lerp(0.19, 0.145, (t - 0.15) / 0.45) : lerp(0.145, 0.175, (t - 0.6) / 0.4)), th: (t) => (t < 0.4 ? lerp(0.08, 0.11, t / 0.4) : lerp(0.11, 0.1, t)), rows: 24, seg: 28 }),
    at(new THREE.CylinderGeometry(0.048, 0.055, 0.1, 16), 0, 1.5, 0),
    at(scaled(new THREE.SphereGeometry(1, 24, 16), 0.075, 0.112, 0.085), 0, 1.63, 0),
    ...[-1, 1].map((s) => sweep({ path: [[s * 0.17, 1.4], [s * 0.222, 1.14], [s * 0.235, 0.88]], w: (t) => lerp(0.042, 0.032, t), th: (t) => lerp(0.042, 0.034, t), rows: 12, seg: 14 })),
    ...[-1, 1].map((s) => sweep({ path: [[s * 0.085, 0.97], [s * 0.09, 0.52], [s * 0.09, 0.09]], w: (t) => lerp(0.075, 0.042, t), th: (t) => lerp(0.075, 0.045, t), rows: 16, seg: 16 })),
    ...[-1, 1].map((s) => at(new RoundedBoxGeometry(0.075, 0.07, 0.22, 2, 0.03), s * 0.09, 0.055, 0)),
  ]
  // Деталь «рукав» строится шириной по z и толщиной по x — поворачиваем лицом к +z
  const g = merge(parts)
  g.rotateY(Math.PI / 2)
  return g
}

function wornTop(long: boolean): GarmentPart[] {
  const parts: THREE.BufferGeometry[] = [
    sweep({ path: [[0, 1.485], [0, 1.3], [0, 1.1], [0, 0.88]], w: (t) => (t < 0.15 ? lerp(0.14, 0.205, smooth(t / 0.15)) : t < 0.6 ? lerp(0.2, 0.17, (t - 0.15) / 0.45) : lerp(0.17, 0.185, (t - 0.6) / 0.4)), th: (t) => (t < 0.4 ? lerp(0.092, 0.122, t / 0.4) : lerp(0.122, 0.112, t)), fold: (t) => 0.005 * t, rows: 20, seg: 28 }),
    ...[-1, 1].map((s) => sweep({ path: long ? [[s * 0.15, 1.45], [s * 0.205, 1.38], [s * 0.226, 1.14], [s * 0.237, 0.9]] : [[s * 0.15, 1.45], [s * 0.205, 1.38], [s * 0.218, 1.24]], w: (t) => lerp(0.055, long ? 0.042 : 0.052, t) * (t < 0.15 ? lerp(0.8, 1, smooth(t / 0.15)) : 1), th: (t) => lerp(0.06, long ? 0.046 : 0.054, t) * (t < 0.15 ? lerp(0.85, 1, smooth(t / 0.15)) : 1), rows: 14, seg: 16 })),
    at(collar(0.06, 0.012, 1), 0, 1.49, 0),
  ]
  const g = merge(parts)
  g.rotateY(Math.PI / 2)
  return [{ geo: g, mat: "cloth", tint: true }]
}

function wornBottom(): GarmentPart[] {
  const parts: THREE.BufferGeometry[] = [
    sweep({ path: [[0, 1.02], [0, 0.82]], w: (t) => lerp(0.168, 0.188, t), th: () => 0.112, rows: 8, seg: 28 }),
    ...[-1, 1].map((s) => sweep({ path: [[s * 0.088, 0.9], [s * 0.093, 0.5], [s * 0.095, 0.1]], w: (t) => lerp(0.088, 0.06, t), th: (t) => lerp(0.088, 0.062, t), fold: (t) => 0.004 * t, rows: 16, seg: 18 })),
  ]
  const g = merge(parts)
  g.rotateY(Math.PI / 2)
  return [{ geo: g, mat: "cloth", tint: true }]
}

export function buildGarments(): Record<GarmentKind, GarmentPart[]> {
  return {
    tee: tee(false), longsleeve: tee(true), shirt: shirt(), hoodie: hoodie(), sweater: sweater(),
    jacket: jacket(false), puffer: jacket(true), pants: bottoms(1.0, 0.095), shorts: bottoms(0.52, 0.105),
    fold: folded(), shoe: shoe(), bag: bag(), cap: cap(),
    worn_top: wornTop(true), worn_tee: wornTop(false), worn_bottom: wornBottom(),
  }
}

/** Что надеть на манекен: верх (длинный или короткий рукав) и низ */
export const WORN: Partial<Record<GarmentKind, GarmentKind>> = {
  tee: "worn_tee", shirt: "worn_top", longsleeve: "worn_top", hoodie: "worn_top", sweater: "worn_top", jacket: "worn_top", puffer: "worn_top",
  pants: "worn_bottom", shorts: "worn_bottom",
}

// ── Ткани: рельеф без файлов-текстур ──

/** Карта нормалей из функции высоты (плетение, вязка, стёжка) */
function normalMap(size: number, height: (x: number, y: number) => number, strength: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  const h = (x: number, y: number) => height(((x % size) + size) % size / size, ((y % size) + size) % size / size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength
    const l = Math.hypot(dx, dy, 1)
    const i = (y * size + x) * 4
    data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255)
    data[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255)
    data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255)
    data[i + 3] = 255
  }
  const t = new THREE.DataTexture(data, size, size)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

let seedN = 12345
const noise = () => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647 }

export function fabricMaterials(): Record<PartMat, THREE.Material> {
  const grain = Array.from({ length: 64 * 64 }, () => noise())
  const g = (x: number, y: number) => grain[Math.floor(y * 64) * 64 + Math.floor(x * 64)]
  // Плетение: саржа (диагональ) + шум
  const weave = normalMap(128, (x, y) => 0.5 * Math.sin((x + y) * Math.PI * 2 * 16) + 0.3 * g(x, y), 1.2)
  weave.repeat.set(6, 22)
  // Вязка: вертикальные косички-петли
  const knit = normalMap(128, (x, y) => Math.abs(Math.sin(x * Math.PI * 8)) * (0.6 + 0.4 * Math.sin(y * Math.PI * 16 + (Math.floor(x * 8) % 2) * Math.PI)) + 0.15 * g(x, y), 2.4)
  knit.repeat.set(5, 12)
  const nylonN = normalMap(64, (x, y) => 0.2 * g(x, y), 0.8)
  nylonN.repeat.set(8, 20)
  return {
    cloth: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.88, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color("#ffffff"), normalMap: weave, normalScale: new THREE.Vector2(0.35, 0.35) }),
    knit: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.95, sheen: 0.8, sheenRoughness: 0.9, sheenColor: new THREE.Color("#ffffff"), normalMap: knit, normalScale: new THREE.Vector2(0.8, 0.8) }),
    nylon: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.2, normalMap: nylonN, normalScale: new THREE.Vector2(0.2, 0.2) }),
    hanger: new THREE.MeshStandardMaterial({ color: "#1b1b1d", roughness: 0.45, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: "#c8c9cb", roughness: 0.3, metalness: 0.95 }),
    sole: new THREE.MeshStandardMaterial({ color: "#f1f0ea", roughness: 0.75 }),
    button: new THREE.MeshStandardMaterial({ color: "#ece9e1", roughness: 0.5 }),
  }
}
