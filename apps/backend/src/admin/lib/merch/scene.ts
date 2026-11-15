import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js"
import { closedSides, type Slot } from "../../../lib/merch/autofill"
import { Item, LayoutData, Room, typeOf, WallFinish, WallSide, Zone } from "./catalog"
import { buildGarments, fabricMaterials, type GarmentKind, type GarmentPart, mannequinBody, type PartMat, WORN } from "./garments"

/**
 * 3D-вид торгового зала. Строится из той же расстановки, что и план.
 * Каждая единица оборудования — своя группа (вещи-заглушки внутри неё), поэтому при перетаскивании
 * двигается вся группа, а пересобираются только изменённые единицы.
 */

export type ViewMode = "orbit" | "walk"
export type CameraPreset = "corner" | "top" | "entrance"

/** Вид и цвет настоящего товара в 3D */
/** step — шаг на штанге, м; faceW — ширина плечиков (вещь лицом вперёд), м */
export type ProductLook = { kind: InstKind; color: string; step?: number; faceW?: number }
type Opts = { clothes: boolean; zones: boolean; selected: string | null; looks?: Map<string, ProductLook> }
type Callbacks = { onSelect: (id: string | null) => void; onMove: (id: string, x: number, y: number) => void }

const DEG = Math.PI / 180

// Простое повторяемое «случайное» число: вещи на стойке не прыгают при каждой перерисовке
function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// Цвета одежды — как в зале: много чёрного, серого, тёмно-синего, белого, немного акцентов
const PALETTE: [string, number][] = [
  ["#141414", 26], ["#2b2b2d", 12], ["#1d2433", 12], ["#6b6e73", 9], ["#a9abad", 6], ["#ecebe6", 11],
  ["#d9cdb8", 7], ["#4f5a3c", 4], ["#4a6382", 5], ["#c4566b", 2], ["#d4682c", 2], ["#7a2430", 2], ["#2f5a46", 2],
]
const PAL_TOTAL = PALETTE.reduce((s, p) => s + p[1], 0)
function pickColor(r: () => number) {
  let x = r() * PAL_TOTAL
  for (const [c, w] of PALETTE) if ((x -= w) <= 0) return c
  return PALETTE[0][0]
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = true) {
  const c = document.createElement("canvas")
  c.width = c.height = size
  draw(c.getContext("2d")!, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

/** Кирпич: текстура на 1 × 1 м (кирпич 25 × 6,5 см, шов 1 см) */
function brickTexture() {
  return canvasTexture(1024, (g, s) => {
    const r = rng("brick")
    const px = s / 1 // пикселей на метр
    g.fillStyle = "#8f8a83"
    g.fillRect(0, 0, s, s)
    const bh = 0.065 * px, bw = 0.25 * px, gap = 0.01 * px
    for (let row = 0, y = 0; y < s; row++, y += bh + gap) {
      const shift = row % 2 ? bw / 2 : 0
      for (let x = -shift; x < s; x += bw + gap) {
        const k = r()
        const base = [178 + k * 30, 84 + k * 22, 56 + k * 14]
        g.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`
        g.fillRect(x, y, bw, bh)
        g.fillStyle = `rgba(0,0,0,${r() * 0.12})`
        g.fillRect(x, y + bh * 0.6, bw, bh * 0.4)
      }
    }
  })
}

function concreteTexture() {
  return canvasTexture(512, (g, s) => {
    const r = rng("concrete")
    g.fillStyle = "#c9c9c5"
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 9000; i++) {
      const v = 170 + r() * 60
      g.fillStyle = `rgba(${v},${v},${v - 4},0.25)`
      g.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 3)
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(120,120,115,${0.03 + r() * 0.04})`
      g.beginPath()
      g.arc(r() * s, r() * s, 20 + r() * 80, 0, Math.PI * 2)
      g.fill()
    }
  })
}

function logoTexture() {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = "#3b3b3e"
    g.fillRect(0, 0, s, s)
    g.fillStyle = "#f2f2f2"
    g.font = "600 92px Inter, Arial, sans-serif"
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillText("la:flamme", s / 2, s / 2)
  }, false)
}

/** Мятая полупрозрачная плёнка перегородки: светлые и тёмные грани, как смятая калька */
function crumpledTexture() {
  return canvasTexture(512, (g, s) => {
    const r = rng("film")
    g.fillStyle = "#b9bcbf"
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 260; i++) {
      const cx = r() * s, cy = r() * s, rad = 20 + r() * 70
      g.beginPath()
      const k = 3 + Math.floor(r() * 3)
      for (let j = 0; j < k; j++) {
        const a = (j / k) * Math.PI * 2 + r() * 0.8
        const x = cx + Math.cos(a) * rad * (0.5 + r()), y = cy + Math.sin(a) * rad * (0.5 + r())
        if (j === 0) g.moveTo(x, y); else g.lineTo(x, y)
      }
      g.closePath()
      const v = 150 + Math.floor(r() * 90)
      g.fillStyle = `rgba(${v},${v + 2},${v + 4},0.35)`
      g.fill()
      g.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.2})`
      g.lineWidth = 1
      g.stroke()
    }
  })
}

function gridAlpha() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = "#000"
    g.fillRect(0, 0, s, s)
    g.fillStyle = "#fff"
    const step = s / 16
    for (let i = 0; i <= 16; i++) {
      g.fillRect(i * step - 2, 0, 4, s)
      g.fillRect(0, i * step - 2, s, 4)
    }
    g.fillRect(0, 0, s, 10); g.fillRect(0, s - 10, s, 10); g.fillRect(0, 0, 10, s); g.fillRect(s - 10, 0, 10, s)
  }, false)
}

export type InstKind = GarmentKind

/**
 * Для трассировщика: только position, normal, uv (и color), обычные Float32-массивы ровно нужной длины —
 * иначе склейка сцены падает на деталях с «запасом» в массиве или с упакованными атрибутами
 */
function cleanAttributes(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count
  if (!g.attributes.normal) g.computeVertexNormals()
  for (const k of Object.keys(g.attributes)) {
    if (!["position", "normal", "uv", "color"].includes(k)) { g.deleteAttribute(k); continue }
    const a = g.getAttribute(k) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute
    const size = k === "uv" ? 2 : k === "color" ? 4 : 3
    const out = new Float32Array(n * size)
    for (let i = 0; i < n; i++) {
      out[i * size] = a.getX(i)
      out[i * size + 1] = a.getY(i)
      if (size >= 3) out[i * size + 2] = a.itemSize > 2 ? a.getZ(i) : 0
      if (size === 4) out[i * size + 3] = a.itemSize > 3 ? a.getW(i) : 1
    }
    g.setAttribute(k, new THREE.BufferAttribute(out, size))
  }
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  if (g.index && g.index.array.length !== g.index.count) g.setIndex(Array.from(g.index.array.slice(0, g.index.count)))
}

/** Часть геометрии по списку треугольников: только используемые вершины, своя нумерация */
function subGeometry(g: THREE.BufferGeometry, idx: number[]): THREE.BufferGeometry {
  const map = new Map<number, number>()
  const order: number[] = []
  const index = idx.map((i) => { let j = map.get(i); if (j === undefined) { j = order.length; map.set(i, j); order.push(i) } return j })
  const out = new THREE.BufferGeometry()
  for (const [k, a] of Object.entries(g.attributes)) {
    const size = a.itemSize
    const arr = new Float32Array(order.length * size)
    order.forEach((src, n) => { for (let c = 0; c < size; c++) arr[n * size + c] = a.getComponent(src, c) })
    out.setAttribute(k, new THREE.BufferAttribute(arr, size))
  }
  out.setIndex(index)
  return out
}

/** Средний цвет картинки текстуры (для фотоснимка) */
function averageColor(t: THREE.Texture): THREE.Color | null {
  const img = t.image as CanvasImageSource & { width?: number; height?: number }
  if (!img || typeof document === "undefined" || !(img instanceof HTMLCanvasElement || img instanceof HTMLImageElement || img instanceof ImageBitmap)) return null
  const c = document.createElement("canvas")
  c.width = c.height = 8
  const g = c.getContext("2d")
  if (!g) return null
  g.drawImage(img, 0, 0, 8, 8)
  const d = g.getImageData(0, 0, 8, 8).data
  let r = 0, gg = 0, b = 0
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2] }
  const n = d.length / 4
  return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace)
}

/** Пример вещи на пустой штанге */
function demoKind(k: number): InstKind {
  return k < 0.2 ? "tee" : k < 0.3 ? "longsleeve" : k < 0.4 ? "shirt" : k < 0.55 ? "hoodie" : k < 0.65 ? "sweater" : k < 0.76 ? "jacket" : k < 0.84 ? "puffer" : k < 0.94 ? "pants" : "shorts"
}

export class MerchScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private ro: ResizeObserver
  private roomGroup = new THREE.Group()
  private itemsGroup = new THREE.Group()
  private zonesGroup = new THREE.Group()
  private ceilingGroup = new THREE.Group()
  private walls: Record<WallSide, THREE.Group> = { top: new THREE.Group(), right: new THREE.Group(), bottom: new THREE.Group(), left: new THREE.Group() }
  private itemCache = new Map<string, { key: string; group: THREE.Group }>()
  /** Вход, поставленный элементом на плане (важнее двери в стене) */
  private entranceItem: Item | null = null
  private roomKey = ""
  private zonesKey = ""
  private sun: THREE.DirectionalLight
  private room: Room | null = null
  private opts: Opts = { clothes: true, zones: false, selected: null }
  private selBox: THREE.Box3Helper | null = null
  private mode: ViewMode = "orbit"
  private keys = new Set<string>()
  private yaw = 0
  private pitch = 0
  private drag: { id: string; group: THREE.Group; dx: number; dz: number; moved: boolean } | null = null
  private look: { x: number; y: number } | null = null
  /** Закреплённое оборудование мышкой не двигается */
  private fixedIds = new Set<string>()
  /** Плавный перелёт точки обзора (двойной клик) */
  private fly: { target: THREE.Vector3; cam: THREE.Vector3 } | null = null
  private ray = new THREE.Raycaster()
  private mats: Record<string, THREE.Material>
  private geos: Record<string, THREE.BufferGeometry>
  /** Модели вещей и их материалы (общие для всего зала) */
  private garments: Record<GarmentKind, GarmentPart[]>
  private fab: Record<PartMat, THREE.Material>
  private manGeo: THREE.BufferGeometry
  /** Общие геометрии — не удаляются вместе с оборудованием */
  private shared = new Set<THREE.BufferGeometry>()
  private clock = new THREE.Clock()
  /** Идёт фотоснимок — обычная отрисовка на паузе */
  private photoBusy = false

  constructor(private el: HTMLElement, private cb: Callbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.display = "block"
    this.renderer.domElement.style.touchAction = "none"

    this.scene.background = new THREE.Color("#18181a")
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.55

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = 88 * DEG
    this.controls.minDistance = 1
    // Правая кнопка (или Shift + левая) двигает точку обзора по полу, а не по экрану
    this.controls.screenSpacePanning = false
    this.controls.panSpeed = 1.2

    this.scene.add(new THREE.HemisphereLight("#ffffff", "#5a5550", 0.9))
    this.sun = new THREE.DirectionalLight("#fff6ea", 1.6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.02
    this.sun.shadow.radius = 4
    this.scene.add(this.sun, this.sun.target)

    this.scene.add(this.roomGroup, this.itemsGroup, this.zonesGroup, this.ceilingGroup)
    for (const g of Object.values(this.walls)) this.roomGroup.add(g)

    const steel = new THREE.MeshStandardMaterial({ color: "#d6d8da", metalness: 1, roughness: 0.26 })
    const brushed = new THREE.MeshStandardMaterial({ color: "#a9adb2", metalness: 0.85, roughness: 0.42 })
    // Всё оборудование — нержавейка: полированные трубы и шлифованные листы
    const blued = new THREE.MeshStandardMaterial({ color: "#b9bdc1", metalness: 0.92, roughness: 0.3 })
    this.mats = {
      steel, brushed, blued,
      black: new THREE.MeshStandardMaterial({ color: "#121212", metalness: 0.4, roughness: 0.5 }),
      curtain: new THREE.MeshStandardMaterial({ color: "#16171b", roughness: 1, side: THREE.DoubleSide }),
      glass: new THREE.MeshStandardMaterial({ color: "#e4e9ec", roughness: 0.5, metalness: 0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
      mirror: new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 1, roughness: 0.03 }),
      concrete: new THREE.MeshStandardMaterial({ color: "#b9b8b4", roughness: 0.9 }),
      counter: new THREE.MeshStandardMaterial({ color: "#d9d7d2", roughness: 0.7 }),
      white: new THREE.MeshStandardMaterial({ color: "#f1f0ec", roughness: 0.6 }),
      roof: new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
      sky: new THREE.MeshStandardMaterial({ color: "#3d7fd6", emissive: "#4f8fe6", emissiveIntensity: 1.2, side: THREE.DoubleSide }),
      fabric: new THREE.MeshStandardMaterial({ color: "#3b3b3e", roughness: 0.95 }),
      logo: new THREE.MeshStandardMaterial({ map: logoTexture(), roughness: 0.95 }),
      mannequin: new THREE.MeshStandardMaterial({ color: "#efeeea", roughness: 0.6 }),
      cabinet: new THREE.MeshStandardMaterial({ color: "#4a4c50", roughness: 0.6, metalness: 0.2 }),
      film: (() => {
        const t = crumpledTexture()
        t.repeat.set(1, 1)
        return new THREE.MeshStandardMaterial({ map: t, color: "#d9dcdf", roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
      })(),
      grid: new THREE.MeshStandardMaterial({ color: "#c7cacd", metalness: 0.9, roughness: 0.35, alphaMap: gridAlpha(), alphaTest: 0.5, side: THREE.DoubleSide }),
      spot: new THREE.MeshStandardMaterial({ color: "#fff8e6", emissive: "#fff3d0", emissiveIntensity: 3 }),
      cloth: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92 }),
      hanger: new THREE.MeshStandardMaterial({ color: "#c9cbcd", metalness: 0.9, roughness: 0.3 }),
    }
    this.geos = {
      tube: new THREE.CylinderGeometry(1, 1, 1, 14),
      box: new THREE.BoxGeometry(1, 1, 1),
    }
    this.garments = buildGarments()
    this.fab = fabricMaterials()
    this.manGeo = mannequinBody()
    for (const g of Object.values(this.geos)) this.shared.add(g)
    for (const parts of Object.values(this.garments)) for (const p of parts) this.shared.add(p.geo)
    this.shared.add(this.manGeo)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(el)
    this.resize()

    const dom = this.renderer.domElement
    dom.addEventListener("pointerdown", this.onDown)
    window.addEventListener("pointermove", this.onMoveEv)
    window.addEventListener("pointerup", this.onUp)
    dom.addEventListener("wheel", this.onWheel, { passive: false })
    dom.addEventListener("dblclick", this.onDbl)
    window.addEventListener("keydown", this.onKey)
    window.addEventListener("keyup", this.onKeyUp)
    this.renderer.setAnimationLoop(() => this.tick())
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.ro.disconnect()
    const dom = this.renderer.domElement
    dom.removeEventListener("pointerdown", this.onDown)
    window.removeEventListener("pointermove", this.onMoveEv)
    window.removeEventListener("pointerup", this.onUp)
    dom.removeEventListener("wheel", this.onWheel)
    dom.removeEventListener("dblclick", this.onDbl)
    window.removeEventListener("keydown", this.onKey)
    window.removeEventListener("keyup", this.onKeyUp)
    this.controls.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry && !this.shared.has(m.geometry)) m.geometry.dispose()
    })
    this.shared.forEach((g) => g.dispose())
    Object.values(this.fab).forEach((m) => m.dispose())
    Object.values(this.mats).forEach((m) => m.dispose())
    this.renderer.dispose()
    dom.remove()
  }

  private resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = "100%"
    this.renderer.domElement.style.height = "100%"
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  // ── Данные ──

  setData(data: LayoutData, opts: Opts) {
    const firstRoom = !this.room

    const clothesChanged = opts.clothes !== this.opts.clothes
    this.opts = opts
    const rk = JSON.stringify(data.room)
    if (rk !== this.roomKey) {
      this.roomKey = rk
      this.room = data.room
      this.buildRoom(data.room)
      if (firstRoom) this.preset("corner")
    }
    // Оборудование: пересобираем только изменённое
    const seen = new Set<string>()
    this.entranceItem = data.items.find((i) => i.type === "entrance") ?? null
    this.fixedIds = new Set(data.items.filter((i) => i.fixed).map((i) => i.id))
    for (const raw of data.items) {
      // Квадратная стойка: сторона у колонны или стены закрыта — вещи там не висят
      const it = raw.type === "rack_square" ? { ...raw, closed: closedSides(raw, data.items, data.room) } : raw
      seen.add(it.id)
      const slots = data.assign?.[it.id]
      const key = JSON.stringify(it) + (opts.clothes ? "c" : "") + (slots ? JSON.stringify(slots.map((x) => [x.p, x.n, x.place, x.face, opts.looks?.get(x.p)?.color, opts.looks?.get(x.p)?.step])) : "")
      const cached = this.itemCache.get(it.id)
      if (cached && cached.key === key && !clothesChanged) continue
      if (cached) this.removeGroup(cached.group)
      const g = this.buildItem(it, slots)
      this.itemsGroup.add(g)
      this.itemCache.set(it.id, { key, group: g })
    }
    for (const [id, c] of this.itemCache) if (!seen.has(id)) { this.removeGroup(c.group); this.itemCache.delete(id) }
    const zk = JSON.stringify(data.zones) + opts.zones
    if (zk !== this.zonesKey) { this.zonesKey = zk; this.buildZones(data.zones, opts.zones) }
    this.updateSelection()
  }

  private removeGroup(g: THREE.Object3D) {
    g.removeFromParent()
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry && !this.shared.has(m.geometry)) m.geometry.dispose()
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose()
    })
  }

  private updateSelection() {
    if (this.selBox) { this.selBox.removeFromParent(); this.selBox = null }
    const g = this.opts.selected ? this.itemCache.get(this.opts.selected)?.group : null
    if (!g) return
    const box = new THREE.Box3().setFromObject(g, true)
    this.selBox = new THREE.Box3Helper(box, new THREE.Color("#3b82f6"))
    this.scene.add(this.selBox)
  }

  // ── Помещение ──

  private finishMat(f: WallFinish, len: number, h: number) {
    if (f === "brick") {
      const t = brickTexture()
      t.repeat.set(len, h)
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 })
    }
    if (f === "glass") return this.mats.glass
    if (f === "concrete") return new THREE.MeshStandardMaterial({ color: "#a9a8a3", roughness: 0.9 })
    return new THREE.MeshStandardMaterial({ color: "#ecebe7", roughness: 0.85 })
  }

  private buildRoom(room: Room) {
    for (const g of [...Object.values(this.walls), this.ceilingGroup]) {
      for (const c of [...g.children]) this.removeGroup(c)
    }
    this.roomGroup.children.filter((c) => !Object.values(this.walls).includes(c as THREE.Group)).forEach((c) => this.removeGroup(c))
    const { width: W, length: L, height: H } = room

    const floorTex = concreteTexture()
    floorTex.repeat.set(W / 2, L / 2)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75, metalness: 0.05 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(W / 2, 0, L / 2)
    floor.receiveShadow = true
    floor.name = "floor"
    this.roomGroup.add(floor)

    const T = 0.15
    const sides: { side: WallSide; len: number; place: (a: number, b: number, y0: number, y1: number) => THREE.Mesh }[] = [
      { side: "top", len: W, place: (a, b, y0, y1) => this.wallBox(a, b, y0, y1, T, (m, cx, cy, l, hh) => { m.position.set(cx, cy, -T / 2); m.scale.set(l, hh, T) }) },
      { side: "bottom", len: W, place: (a, b, y0, y1) => this.wallBox(a, b, y0, y1, T, (m, cx, cy, l, hh) => { m.position.set(cx, cy, L + T / 2); m.scale.set(l, hh, T) }) },
      { side: "left", len: L, place: (a, b, y0, y1) => this.wallBox(a, b, y0, y1, T, (m, cx, cy, l, hh) => { m.position.set(-T / 2, cy, cx); m.scale.set(T, hh, l) }) },
      { side: "right", len: L, place: (a, b, y0, y1) => this.wallBox(a, b, y0, y1, T, (m, cx, cy, l, hh) => { m.position.set(W + T / 2, cy, cx); m.scale.set(T, hh, l) }) },
    ]
    // Мансарда: длинные стены (верхняя и нижняя на плане) — до начала ската, торцевые — с фронтоном
    const E = Math.min(H, room.eave ?? H)
    for (const s of sides) {
      const finish = room.walls[s.side]
      const long = s.side === "top" || s.side === "bottom"
      const Hs = long ? E : H
      const mat = this.finishMat(finish, s.len, Hs)
      const ops = room.openings.filter((o) => o.wall === s.side).sort((a, b) => a.offset - b.offset)
      if (!long && E < H && ops.length === 0) {
        this.walls[s.side].add(this.gable(finish, L, E, H, s.side === "left" ? 0 : W))
        continue
      }
      let cur = 0
      const add = (a: number, b: number, y0: number, y1: number) => {
        if (b - a < 0.01 || y1 - y0 < 0.01) return
        const m = s.place(a, b, y0, y1)
        m.material = mat
        if (finish === "brick") this.fitUV(m, b - a, y1 - y0)
        this.walls[s.side].add(m)
      }
      for (const o of ops) {
        const a = Math.max(cur, o.offset), b = Math.min(s.len, o.offset + o.width)
        add(cur, a, 0, Hs)
        if (o.kind === "door") add(a, b, 2.4, Hs)
        else {
          const bottom = o.kind === "showcase" ? 0.15 : 0.9
          add(a, b, 0, bottom)
          add(a, b, Math.min(2.7, Hs), Hs)
          const glass = s.place(a, b, bottom, Math.min(2.7, Hs))
          glass.material = this.mats.glass
          glass.scale[s.side === "left" || s.side === "right" ? "x" : "z"] = 0.02
          this.walls[s.side].add(glass)
        }
        cur = Math.max(cur, b)
      }
      add(cur, s.len, 0, Hs)
    }

    // Крыша (чёрная, мансардная: скаты от длинных стен к коньку), балки, мансардные окна, красный воздуховод —
    // видны только при обходе зала, в обзоре сверху не мешают
    const roofY = (z: number) => E + (H - E) * (1 - Math.abs(z - L / 2) / (L / 2))
    const quad = (pts: THREE.Vector3[], mat: THREE.Material) => {
      const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]])
      geo.computeVertexNormals()
      const m = new THREE.Mesh(geo, mat)
      this.ceilingGroup.add(m)
      return m
    }
    const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    quad([v3(0, E, 0), v3(W, E, 0), v3(W, H, L / 2), v3(0, H, L / 2)], this.mats.roof)
    quad([v3(0, H, L / 2), v3(W, H, L / 2), v3(W, E, L), v3(0, E, L)], this.mats.roof)
    const beams = new THREE.Group()
    for (let x = 0.6; x < W; x += 1.2) {
      const tmp = new THREE.Group()
      this.pipe(tmp, v3(x, E - 0.06, 0), v3(x, H - 0.06, L / 2), 0.05, this.mats.black)
      this.pipe(tmp, v3(x, H - 0.06, L / 2), v3(x, E - 0.06, L), 0.05, this.mats.black)
      beams.add(...tmp.children)
    }
    this.ceilingGroup.add(beams)
    if (H > E) {
      // Мансардные окна на верхнем скате
      for (const fx of [0.3, 0.62]) {
        const z0 = L * 0.2, z1 = L * 0.38, x0 = W * fx, x1 = x0 + 0.9
        quad([v3(x0, roofY(z0) - 0.02, z0), v3(x1, roofY(z0) - 0.02, z0), v3(x1, roofY(z1) - 0.02, z1), v3(x0, roofY(z1) - 0.02, z1)], this.mats.sky)
      }
    }
    const ductZ = Math.min(1.4, L / 4)
    const duct = new THREE.Mesh(this.geos.tube, new THREE.MeshStandardMaterial({ color: "#b3262b", roughness: 0.45, metalness: 0.3 }))
    duct.scale.set(0.22, W - 0.4, 0.22)
    duct.rotation.z = Math.PI / 2
    duct.position.set(W / 2, roofY(ductZ) - 0.4, ductZ)
    this.ceilingGroup.add(duct)
    this.ceilingGroup.visible = this.mode === "walk"

    // Свет: «солнце» под углом для мягких теней, размер теневой камеры — по залу
    const c = Math.max(W, L)
    this.sun.position.set(W * 0.3, H + 8, -L * 0.2)
    this.sun.target.position.set(W / 2, 0, L / 2)
    const sc = this.sun.shadow.camera
    sc.left = -c * 0.75; sc.right = c * 0.75; sc.top = c * 0.75; sc.bottom = -c * 0.75; sc.near = 1; sc.far = c * 3
    sc.updateProjectionMatrix()
    this.controls.target.set(W / 2, 0.8, L / 2)
  }

  /** Торцевая стена с фронтоном под мансардную крышу */
  private gable(f: WallFinish, L: number, E: number, H: number, x: number) {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, 0), new THREE.Vector2(L, E), new THREE.Vector2(L / 2, H), new THREE.Vector2(0, E)])
    const geo = new THREE.ShapeGeometry(shape)
    let mat: THREE.Material
    if (f === "brick") {
      const t = brickTexture()
      t.repeat.set(1, 1) // координаты фигуры уже в метрах, текстура — на метр
      mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, side: THREE.DoubleSide })
    } else if (f === "glass") mat = this.mats.glass
    else mat = new THREE.MeshStandardMaterial({ color: f === "concrete" ? "#a9a8a3" : "#ecebe7", roughness: 0.85, side: THREE.DoubleSide })
    const m = new THREE.Mesh(geo, mat)
    m.rotation.y = -Math.PI / 2
    m.position.set(x, 0, 0)
    m.receiveShadow = true
    return m
  }

  private wallBox(a: number, b: number, y0: number, y1: number, _t: number, set: (m: THREE.Mesh, cx: number, cy: number, l: number, h: number) => void) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    set(m, (a + b) / 2, (y0 + y1) / 2, b - a, y1 - y0)
    m.receiveShadow = true
    m.userData.uv = [a, y0]
    return m
  }

  /** Кирпичная текстура «в метрах» на каждом куске стены — швы совпадают между кусками */
  private fitUV(m: THREE.Mesh, l: number, h: number) {
    const [a, y0] = m.userData.uv as [number, number]
    const g = m.geometry as THREE.BufferGeometry
    const uv = g.attributes.uv as THREE.BufferAttribute
    const pos = g.attributes.position as THREE.BufferAttribute
    const tex = ((m.material as THREE.MeshStandardMaterial).map as THREE.Texture)
    const rx = tex.repeat.x || 1, ry = tex.repeat.y || 1
    for (let i = 0; i < uv.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i)
      // Вдоль стены — по той оси, где кусок длинный
      const along = Math.abs(m.scale.x) > Math.abs(m.scale.z) ? px : pz
      uv.setXY(i, (a + (along + 0.5) * l) / rx, (y0 + (py + 0.5) * h) / ry)
    }
    uv.needsUpdate = true
  }

  private buildZones(zones: Zone[], show: boolean) {
    for (const c of [...this.zonesGroup.children]) this.removeGroup(c)
    if (!show) return
    for (const z of zones) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.d), new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.22, depthWrite: false }))
      m.rotation.x = -Math.PI / 2
      m.position.set(z.x + z.w / 2, 0.006, z.y + z.d / 2)
      this.zonesGroup.add(m)
    }
  }

  // ── Оборудование ──

  private part(g: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, geo: THREE.BufferGeometry = this.geos.box) {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.scale.set(sx, sy, sz)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  /** Труба от точки a до точки b */
  private pipe(g: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, r = 0.02, mat: THREE.Material = this.mats.steel) {
    const len = a.distanceTo(b)
    const m = this.part(g, mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, r, len, r, this.geos.tube)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    return m
  }

  private buildItem(it: Item, slots?: Slot[]): THREE.Group {
    const g = new THREE.Group()
    g.userData.id = it.id
    g.position.set(it.x, it.elev ?? 0, it.y)
    g.rotation.y = -it.rot * DEG
    const t = typeOf(it.type)
    const { w, d, h } = it
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const r = rng(it.id)
    const inst: { kind: InstKind; m: THREE.Matrix4; color: string }[] = []
    const clothes = this.opts.clothes
    // Настоящие товары: очередь вещей по порядку (модель повторяется по числу вешалок/мест)
    const queue = (place: "rail" | "shelf") => {
      const out: (ProductLook & { face?: boolean })[] = []
      for (const sl of slots ?? []) if (sl.place === place) {
        const look = this.opts.looks?.get(sl.p) ?? { kind: place === "rail" ? "tee" : "fold", color: "#8a8d91" }
        // «Лицом вперёд» — первая вешалка модели развёрнута к покупателю
        for (let k = 0; k < Math.max(1, sl.n); k++) out.push(look)
      }
      return out
    }
    const real = !!slots?.length
    const railQ = real ? queue("rail") : null
    const shelfQ = real ? queue("shelf") : null

    /** Вещи на штанге: от x0 до x1 на высоте y, в плоскости z */
    /** Штанга из точки (ax, az) в (bx, bz): вещи поперёк, «лицом вперёд» — наружу (влево от направления) */
    const hangLine = (ax: number, az: number, bx: number, bz: number, y: number) => {
      const len = Math.hypot(bx - ax, bz - az)
      const a = Math.atan2(bz - az, bx - ax)
      const L = new THREE.Matrix4().compose(V(ax, 0, az), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), V(1, 1, 1))
      const start = inst.length
      hangRail(0, len, y, 0)
      for (let i = start; i < inst.length; i++) inst[i].m = L.clone().multiply(inst[i].m)
    }
    const hangRail = (x0: number, x1: number, y: number, z: number) => {
      const step = 0.06
      const n = Math.floor((x1 - x0) / step)
      if (railQ) {
        // Настоящие вещи: шаг по толщине вещи и вешалке, «лицом вперёд» занимает ширину плечиков
        let x = x0
        while (railQ.length) {
          const look = railQ[0]
          const s = look.step ?? step
          if (x + s > x1 + 0.02) break
          railQ.shift()
          // Модели вещей — в натуральную величину; ширина низа — по брючной вешалке
          const k = look.kind === "pants" || look.kind === "shorts" ? (look.faceW ?? 0.3) / 0.3 : 1
          const m = new THREE.Matrix4().compose(V(x + s / 2, y - 0.06, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.12, 0)), V(1, 1, k))
          inst.push({ kind: look.kind, m, color: look.color })
          x += s
        }
        return
      }
      if (!clothes) return
      const fill = 0.55 + r() * 0.35
      for (let i = 0; i < n; i++) {
        if (r() > fill) continue
        const k = r()
        const kind = demoKind(k)
        const m = new THREE.Matrix4().compose(V(x0 + (i + 0.5) * step, y - 0.06, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.15, 0)), V(1, 0.96 + r() * 0.06, 1))
        inst.push({ kind, m, color: pickColor(r) })
      }
    }
    /** Выкладка на полке/столе: стопки, обувь, сумки */
    const onSurface = (x0: number, x1: number, y: number, z: number, what: "fold" | "shoe" | "bag" | "cap" | "mix", depth = 0.3) => {
      const n = Math.max(1, Math.floor((x1 - x0) / 0.42))
      if (shelfQ) {
        for (let i = 0; i < n && shelfQ.length; i++) {
          const look = shelfQ.shift()!
          const x = x0 + ((i + 0.5) * (x1 - x0)) / n
          if (look.kind === "fold") {
            for (let k = 0; k < 3; k++) inst.push({ kind: "fold", m: new THREE.Matrix4().compose(V(x, y + 0.018 + k * 0.036, z), new THREE.Quaternion(), V(1, 1, 1)), color: look.color })
          } else {
            const lift = look.kind === "shoe" ? 0.055 : look.kind === "bag" ? 0.12 : 0
            inst.push({ kind: look.kind, m: new THREE.Matrix4().compose(V(x, y + lift, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, look.kind === "shoe" ? 0.15 : 0, 0)), V(1, 1, 1)), color: look.color })
          }
        }
        return
      }
      if (!clothes) return
      for (let i = 0; i < n; i++) {
        if (r() < 0.2) continue
        const kind: InstKind = what === "mix" ? (["fold", "cap", "bag"] as InstKind[])[Math.floor(r() * 3)] : what
        const x = x0 + ((i + 0.5) * (x1 - x0)) / n
        const zz = z + (r() - 0.5) * Math.max(0, depth - 0.3)
        const color = kind === "shoe" ? (r() < 0.55 ? "#efefec" : r() < 0.5 ? "#202020" : "#9a9ea3") : pickColor(r)
        if (kind === "fold") {
          const stack = 2 + Math.floor(r() * 4)
          for (let s = 0; s < stack; s++) inst.push({ kind, m: new THREE.Matrix4().compose(V(x, y + 0.018 + s * 0.036, zz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.08, 0)), V(1, 1, 1)), color: s === 0 ? color : r() < 0.5 ? color : pickColor(r) })
        } else {
          const lift = kind === "shoe" ? 0.055 : kind === "bag" ? 0.12 : 0
          inst.push({ kind, m: new THREE.Matrix4().compose(V(x, y + lift, zz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.4 + (kind === "shoe" ? 0.15 : 0), 0)), V(1, 1, 1)), color })
        }
      }
    }

    const S = this.mats
    switch (it.type) {
      case "wall_system": {
        const n = Math.max(2, Math.round(w / 1.2) + 1)
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + (w * i) / (n - 1)
          this.pipe(g, V(x, 0, 0), V(x, h, 0), 0.022)
          this.part(g, S.steel, x, 0.004, 0, 0.09, 0.008, 0.09, this.geos.tube)
        }
        this.pipe(g, V(-w / 2, 1.75, 0.06), V(w / 2, 1.75, 0.06), 0.016)
        this.part(g, S.brushed, 0, 2.15, -0.02, w, 0.02, d * 0.8)
        hangRail(-w / 2 + 0.05, w / 2 - 0.05, 1.75, 0.06)
        onSurface(-w / 2 + 0.1, w / 2 - 0.1, 2.16, -0.02, "bag")
        break
      }
      case "wall_shelves": {
        this.pipe(g, V(-w / 2, 0, 0.05), V(-w / 2, h, 0.05), 0.022)
        this.pipe(g, V(w / 2, 0, 0.05), V(w / 2, h, 0.05), 0.022)
        const n = typeOf(it.type).shelves ?? 5
        for (let i = 0; i < n; i++) {
          const y = 0.35 + (i * (h - 0.6)) / (n - 1)
          const s = this.part(g, S.blued, 0, y, 0, w - 0.06, 0.012, d)
          s.rotation.x = 0.12
          this.part(g, S.blued, 0, y + 0.03, d / 2 - 0.005, w - 0.06, 0.05, 0.01)
          onSurface(-w / 2 + 0.1, w / 2 - 0.1, y + 0.01, 0, r() < 0.5 ? "cap" : "bag")
        }
        break
      }
      case "rack_base": {
        // Цельный подиум во всю длину и ширину, две пары стоек в 12 см от краёв, штанга на 6 см ниже верха стоек
        this.part(g, S.brushed, 0, 0.02, 0, w, 0.04, d)
        const railY = Math.max(0.5, h - 0.06)
        for (const sx of [-1, 1]) for (const dz of [-0.025, 0.025]) this.pipe(g, V(sx * (w / 2 - 0.12), 0.04, dz), V(sx * (w / 2 - 0.12), h, dz), 0.022)
        this.pipe(g, V(-w / 2 + 0.06, railY, 0), V(w / 2 - 0.06, railY, 0), 0.02)
        hangRail(-w / 2 + 0.12, w / 2 - 0.12, railY, 0)
        break
      }
      case "rack_pipe":
      case "rack_pipe_double": {
        const rails = it.type === "rack_pipe_double" ? [-d / 4, d / 4] : [0]
        for (const sx of [-1, 1]) {
          const x = sx * (w / 2 - 0.03)
          this.pipe(g, V(x, 0.12, -d / 2), V(x, 0.12, d / 2), 0.022)
          for (const z of rails) this.pipe(g, V(x, 0.12, z), V(x, h, z), 0.024)
          for (const z of [-d / 2, d / 2]) this.part(g, S.black, x, 0.05, z, 0.04, 0.1, 0.04, this.geos.tube)
          if (rails.length > 1) this.pipe(g, V(x, h - 0.1, rails[0]), V(x, h - 0.1, rails[1]), 0.02)
        }
        for (const z of [-d / 2, d / 2]) this.pipe(g, V(-w / 2, 0.12, z), V(w / 2, 0.12, z), 0.022)
        for (const z of rails) {
          this.pipe(g, V(-w / 2 - 0.08, h, z), V(w / 2 + 0.08, h, z), 0.024)
          hangRail(-w / 2 + 0.08, w / 2 - 0.08, h, z)
        }
        break
      }
      case "round_rack": {
        const R = w / 2
        this.part(g, S.brushed, 0, 0.01, 0, R * 0.6, 0.02, R * 0.6, this.geos.tube)
        this.pipe(g, V(0, 0, 0), V(0, h, 0), 0.025)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.015, 8, 48), S.steel)
        ring.rotation.x = Math.PI / 2
        ring.position.y = h - 0.05
        ring.castShadow = true
        g.add(ring)
        for (let a = 0; a < 4; a++) this.pipe(g, V(0, h - 0.05, 0), V(Math.cos(a * Math.PI / 2) * R, h - 0.05, Math.sin(a * Math.PI / 2) * R), 0.012)
        if (railQ || clothes) {
          const n = Math.floor((2 * Math.PI * R) / 0.07)
          for (let i = 0; i < n; i++) {
            if (railQ ? !railQ.length : r() > 0.7) continue
            const a = (i / n) * Math.PI * 2
            const k = r()
            const look = railQ?.shift()
            const kind: InstKind = look?.kind ?? demoKind(k * 0.8)
            inst.push({ kind, m: new THREE.Matrix4().compose(V(Math.cos(a) * R, h - 0.1, Math.sin(a) * R), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), V(1, 1, 1)), color: look?.color ?? pickColor(r) })
          }
        }
        break
      }
      case "shoe_rack": {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.pipe(g, V(sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02)), V(sx * (w / 2 - 0.02), h, sz * (d / 2 - 0.02)), 0.022)
        // Полки через 30 см от верха, полка между стойками (на 6 см уже стеллажа)
        const n = Math.max(1, Math.floor((h - 0.05) / 0.3))
        for (let i = 0; i < n; i++) {
          const y = h - 0.05 - i * 0.3
          this.part(g, S.blued, 0, y, 0, w - 0.06, 0.012, d - 0.02)
          this.pipe(g, V(-w / 2, y + 0.02, d / 2 - 0.02), V(w / 2, y + 0.02, d / 2 - 0.02), 0.014)
          onSurface(-w / 2 + 0.12, w / 2 - 0.12, y + 0.007, 0, "shoe", d)
        }
        break
      }
      case "cabinet": {
        // Шкаф для сумок: боковины, задняя стенка, 4 полки — просветы 55, 40, 40 см, сверху 27 см (при высоте 180)
        const dark = this.mats.cabinet
        for (const sx of [-1, 1]) this.part(g, S.brushed, sx * (w / 2 - 0.01), h / 2, 0, 0.02, h, d)
        this.part(g, dark, 0, h / 2, -d / 2 + 0.01, w - 0.04, h, 0.02)
        const top = h - 0.27 * (h / 1.8)
        const levels = [0.18, 0.18 + 0.55, 0.18 + 0.95, top].map((y) => (y * h) / 1.8)
        for (const y of levels) {
          this.part(g, dark, 0, y, 0, w - 0.04, 0.02, d - 0.02)
          this.part(g, S.brushed, 0, y + 0.012, d / 2 - 0.01, w - 0.04, 0.006, 0.02)
          onSurface(-w / 2 + 0.15, w / 2 - 0.15, y + 0.012, 0.02, "bag")
        }
        break
      }
      case "rack_square": {
        // Квадратная стойка из толстых труб: 4 стойки по углам, штанги по периметру; закрытые стороны — без вещей
        const closed = new Set((it.closed ?? []) as string[])
        const y = h - 0.05
        const corners: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
        for (const [cx, cz] of corners) {
          this.pipe(g, V(cx, 0, cz), V(cx, h, cz), 0.03)
          this.part(g, S.brushed, cx, 0.03, cz, 0.06, 0.06, 0.06, this.geos.tube)
        }
        for (let i = 0; i < 4; i++) {
          const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4]
          this.pipe(g, V(ax, y, az), V(bx, y, bz), 0.025)
          this.pipe(g, V(ax, 0.1, az), V(bx, 0.1, bz), 0.025)
        }
        const inset = 0.05
        const sides: [string, number, number, number, number][] = [
          ["front", -w / 2 + inset, d / 2, w / 2 - inset, d / 2], ["right", w / 2, d / 2 - inset, w / 2, -d / 2 + inset],
          ["back", w / 2 - inset, -d / 2, -w / 2 + inset, -d / 2], ["left", -w / 2, -d / 2 + inset, -w / 2, d / 2 - inset],
        ]
        for (const [side, ax, az, bx, bz] of sides) if (!closed.has(side)) hangLine(ax, az, bx, bz, y)
        break
      }
      case "wall_shelf":
      case "wall_shelf_s": {
        // Полка и планка крепления к стене высотой h (15 см), без боковин
        this.part(g, S.brushed, 0, 0, 0, w, 0.012, d)
        this.part(g, S.brushed, 0, h / 2, -d / 2 + 0.005, w, h, 0.01)
        onSurface(-w / 2 + 0.05, w / 2 - 0.05, 0.006, 0.02, r() < 0.6 ? "fold" : "cap")
        break
      }
      case "underwear_shelf": {
        // Чёрные полки на стене: коробки с бельём
        const n = 5
        for (let i = 0; i < n; i++) {
          const y = 0.2 + (i * (h - 0.3)) / (n - 1)
          this.part(g, S.black, 0, y, 0, w, 0.03, d)
          this.part(g, S.black, 0, y + 0.06, -d / 2 + 0.01, w, 0.12, 0.02)
          onSurface(-w / 2 + 0.08, w / 2 - 0.08, y + 0.015, 0.02, "fold")
        }
        break
      }
      case "grid_panel": {
        this.part(g, S.grid, 0, h / 2, 0, w, h, 0.01)
        if (shelfQ) onSurface(-w / 2 + 0.1, w / 2 - 0.1, h * 0.55, 0.08, "bag")
        else if (clothes) for (let i = 0; i < 4; i++) inst.push({ kind: "bag", m: new THREE.Matrix4().compose(V(-w / 2 + (i + 0.5) * (w / 4), h * (0.45 + (i % 2) * 0.25), 0.08), new THREE.Quaternion(), V(0.8, 0.9, 0.7)), color: r() < 0.8 ? "#151515" : "#d9d9d6" })
        break
      }
      case "table_cube": {
        this.part(g, S.blued, 0, h - 0.01, 0, w, 0.02, d)
        for (const sx of [-1, 1]) this.part(g, S.blued, sx * (w / 2 - 0.01), (h - 0.02) / 2, 0, 0.02, h - 0.02, d)
        onSurface(-w / 2 + 0.15, w / 2 - 0.15, h, 0, "mix", d)
        break
      }
      case "pouf_round": {
        const m = this.part(g, S.fabric, 0, h / 2, 0, w / 2, h, d / 2, new THREE.CylinderGeometry(1, 1, 1, 40))
        m.castShadow = true
        break
      }
      case "table_white": {
        const top = new THREE.Mesh(new RoundedBoxGeometry(w, 0.05, d, 3, 0.02), S.white)
        top.position.y = h - 0.025
        top.castShadow = top.receiveShadow = true
        g.add(top)
        this.part(g, S.white, 0, (h - 0.05) / 2, 0, w * 0.8, h - 0.05, d * 0.8)
        onSurface(-w / 2 + 0.15, w / 2 - 0.15, h, 0, "fold", d)
        break
      }
      case "podium":
        this.part(g, S.concrete, 0, h / 2, 0, w, h, d)
        break
      case "pouf": {
        const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.05), [S.fabric, S.fabric, S.fabric, S.fabric, S.logo, S.fabric])
        m.position.y = h / 2
        m.castShadow = m.receiveShadow = true
        g.add(m)
        break
      }
      case "mannequin": {
        this.part(g, S.brushed, 0, 0.01, 0, 0.18, 0.02, 0.18, this.geos.tube)
        this.pipe(g, V(0, 0, 0), V(0, 1.0, 0), 0.012)
        const body = new THREE.Mesh(this.manGeo, S.mannequin)
        body.castShadow = true
        g.add(body)
        // Образ на манекене: первый верх и первый низ из его товаров (или пример)
        const wear = railQ ?? []
        const top = wear.find((x) => WORN[x.kind] && WORN[x.kind] !== "worn_bottom")
        const bottom = wear.find((x) => WORN[x.kind] === "worn_bottom")
        const one = new THREE.Matrix4()
        if (top || (!railQ && clothes)) inst.push({ kind: top ? WORN[top.kind]! : "worn_top", m: one.clone(), color: top?.color ?? pickColor(r) })
        if (bottom || (!railQ && clothes)) inst.push({ kind: "worn_bottom", m: one.clone(), color: bottom?.color ?? "#26344f" })
        break
      }
      case "mirror":
        this.part(g, S.black, 0, h / 2, 0, w, h, d)
        this.part(g, S.mirror, 0, h / 2, d / 2 + 0.002, w - 0.04, h - 0.04, 0.004)
        break
      case "fitting": {
        const y = h
        for (const [a, b] of [[V(-w / 2, y, -d / 2), V(w / 2, y, -d / 2)], [V(w / 2, y, -d / 2), V(w / 2, y, d / 2)], [V(w / 2, y, d / 2), V(-w / 2, y, d / 2)], [V(-w / 2, y, d / 2), V(-w / 2, y, -d / 2)]] as [THREE.Vector3, THREE.Vector3][]) this.pipe(g, a, b, 0.02)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.pipe(g, V(sx * w / 2, h, sz * d / 2), V(sx * w / 2, h + 0.6, sz * d / 2), 0.008)
        const curtain = (len: number, cx: number, cz: number, rotY: number, frac = 1) => {
          const L = len * frac
          const geo = new THREE.PlaneGeometry(L, h - 0.05, Math.max(8, Math.round(L * 30)), 1)
          const p = geo.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / L) * Math.PI * L * 9) * 0.035)
          geo.computeVertexNormals()
          const m = new THREE.Mesh(geo, S.curtain)
          m.position.set(cx, (h - 0.05) / 2 + 0.02, cz)
          m.rotation.y = rotY
          m.castShadow = m.receiveShadow = true
          g.add(m)
        }
        curtain(w, 0, -d / 2, 0)
        curtain(d, -w / 2, 0, Math.PI / 2)
        curtain(d, w / 2, 0, Math.PI / 2)
        curtain(w, -w * 0.3, d / 2, 0, 0.4)
        break
      }
      case "cash": {
        // Стойка ресепшена (нержавейка): передняя стенка до 120 см с полкой-козырьком 29,5 см, внутри — рабочая поверхность 48 см
        this.part(g, S.brushed, 0, h / 2, d / 2 - 0.01, w, h, 0.02)
        for (const sx of [-1, 1]) this.part(g, S.brushed, sx * (w / 2 - 0.01), h / 2, 0, 0.02, h, d)
        this.part(g, S.brushed, 0, h - 0.01, d / 2 - 0.1475, w, 0.02, 0.295)
        this.part(g, S.brushed, 0, 0.75, -d / 2 + 0.242, w - 0.04, 0.02, 0.484)
        this.part(g, S.black, w / 4, 0.86, -d / 2 + 0.2, 0.32, 0.22, 0.02)
        break
      }
      case "showcase": {
        // Витрина ресепшена: короб из нержавейки, сверху стекло, под ним мелкие аксессуары
        const lowH = Math.max(0.5, h - 0.16)
        this.part(g, S.brushed, 0, lowH / 2, 0, w, lowH, d)
        this.part(g, S.glass, 0, lowH + 0.08, 0, w - 0.02, 0.16, d - 0.02)
        this.part(g, S.brushed, 0, h, 0, w, 0.006, d)
        onSurface(-w / 2 + 0.1, w / 2 - 0.1, lowH + 0.005, d / 4, "bag")
        onSurface(-w / 2 + 0.1, w / 2 - 0.1, lowH + 0.005, -d / 4, "bag")
        break
      }
      case "entrance": {
        // Вход: тёмный проём с рамой из нержавейки, перед ним — коврик
        this.part(g, this.mats.black, 0, h / 2, -d / 2, w, h, 0.03)
        for (const sx of [-1, 1]) this.part(g, S.brushed, sx * (w / 2), h / 2, -d / 2 + 0.03, 0.05, h, 0.06)
        this.part(g, S.brushed, 0, h, -d / 2 + 0.03, w + 0.05, 0.05, 0.06)
        const mat = this.part(g, new THREE.MeshStandardMaterial({ color: "#2b2b2d", roughness: 1 }), 0, 0.005, 0.5, w, 0.01, 0.9)
        mat.castShadow = false
        break
      }
      case "window_item": {
        // Окно в стене: рама и стекло (высота крепления — низ окна)
        this.part(g, S.glass, 0, h / 2, 0, w, h, 0.02)
        for (const sx of [-1, 1]) this.part(g, S.black, sx * (w / 2), h / 2, 0, 0.05, h, 0.08)
        for (const y of [0, h]) this.part(g, S.black, 0, y, 0, w + 0.05, 0.05, 0.08)
        break
      }
      case "column":
        this.part(g, S.concrete, 0, h / 2, 0, w, h, d)
        break
      case "block": {
        // Не наша площадь: снаружи — белые стены, сверху тёмная крышка, чтобы в обзоре было видно, что это не зал
        // Стены вокруг входа и коридора — кирпич, как на рендере
        const brick = (len: number) => { const t = brickTexture(); t.repeat.set(len, h); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }) }
        const sideX = brick(d), sideZ = brick(w)
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [sideX, sideX, this.mats.black, this.mats.black, sideZ, sideZ])
        m.position.set(0, h / 2, 0)
        m.scale.set(w, h, d)
        m.receiveShadow = true
        g.add(m)
        break
      }
      case "partition": {
        // Как в зале: панели из мятой полупрозрачной плёнки на стальных стойках с Т-образными опорами,
        // вторая секция — дверь из вертикальных прутьев (проход на склад)
        const n = Math.max(1, Math.round(w / 1.25))
        const seg = w / n
        for (let i = 0; i < n; i++) {
          const cx = -w / 2 + seg * (i + 0.5)
          if (i === 1 && n >= 3) {
            const bars = Math.round(seg / 0.09)
            for (let b = 1; b < bars; b++) this.pipe(g, V(cx - seg / 2 + (seg * b) / bars, 0.05, 0), V(cx - seg / 2 + (seg * b) / bars, h - 0.05, 0), 0.008)
            for (const y of [0.05, h - 0.05]) this.pipe(g, V(cx - seg / 2, y, 0), V(cx + seg / 2, y, 0), 0.012)
          } else {
            const panel = this.part(g, S.film, cx, h / 2 + 0.03, 0, seg - 0.04, h - 0.06, 1, new THREE.PlaneGeometry(1, 1))
            panel.castShadow = false
            ;((panel.material as THREE.MeshStandardMaterial).map as THREE.Texture).repeat.set(seg, h)
          }
        }
        for (let i = 0; i <= n; i++) {
          const x = -w / 2 + seg * i
          this.pipe(g, V(x, 0, 0), V(x, h, 0), 0.018)
          // Т-образная опора на полу
          this.part(g, S.brushed, x, 0.012, 0, 0.04, 0.024, 0.45)
        }
        this.pipe(g, V(-w / 2, h, 0), V(w / 2, h, 0), 0.015)
        break
      }
      case "track": {
        this.part(g, S.black, 0, 0, 0, w, 0.04, 0.04)
        for (let x = -w / 2 + 0.6; x < w / 2; x += 1.4) {
          const body = this.part(g, S.black, x, -0.12, 0, 0.045, 0.16, 0.045, this.geos.tube)
          body.rotation.x = 0.35
          body.castShadow = false
          const lamp = this.part(g, S.spot, x, -0.2, 0.03, 0.035, 0.005, 0.035, this.geos.tube)
          lamp.castShadow = false
          // Для фотоснимка: здесь будет настоящий прожектор
          lamp.userData.lamp = true
        }
        break
      }
      default:
        this.part(g, S.brushed, 0, h / 2, 0, w, h, d)
    }
    void t

    // Вещи — по одной «пачке» на вид: десятки вещей рисуются за один вызов
    const byKind = new Map<InstKind, typeof inst>()
    for (const x of inst) byKind.set(x.kind, [...(byKind.get(x.kind) ?? []), x])
    for (const [kind, list] of byKind) {
      // Каждая вещь — несколько частей: ткань в цвет товара, вешалка, молния, подошва
      for (const part of this.garments[kind] ?? []) {
        const im = new THREE.InstancedMesh(part.geo, this.fab[part.mat], list.length)
        const c = new THREE.Color()
        list.forEach((x, i) => { im.setMatrixAt(i, x.m); if (part.tint) im.setColorAt(i, c.set(x.color)) })
        im.castShadow = part.mat !== "hanger"
        im.receiveShadow = true
        im.computeBoundingSphere()
        g.add(im)
      }
    }
    return g
  }

  // ── Камера ──

  preset(p: CameraPreset) {
    if (!this.room) return
    const { width: W, length: L } = this.room
    if (this.mode === "walk") { this.enterWalk(); return }
    if (p === "top") {
      this.camera.position.set(W / 2, Math.max(W, L) * 1.15, L / 2 + 0.01)
      this.controls.target.set(W / 2, 0, L / 2)
    } else if (p === "entrance") {
      const door = this.entrance()
      // Чуть выше роста, чтобы ближняя стойка не закрывала зал
      this.camera.position.set(door.x, 2.3, door.z)
      this.controls.target.set(W / 2, 0.9, L / 2)
    } else {
      this.camera.position.set(W * 0.95, Math.max(W, L) * 0.62, L * 1.85)
      this.controls.target.set(W / 2, 0.6, L / 2)
    }
    this.controls.update()
  }

  /** Точка чуть внутри входной двери (или середина нижней стены) */
  private entrance() {
    const room = this.room!
    const ei = this.entranceItem
    if (ei) {
      // Стоим перед входом, лицом наружу от его стены (в магазин)
      const a = (ei.rot * Math.PI) / 180
      const dx = -Math.sin(a), dy = Math.cos(a)
      return { x: ei.x + dx * 0.6, z: ei.y + dy * 0.6, yaw: Math.atan2(dx, dy) }
    }
    const door = room.openings.find((o) => o.kind === "door")
    if (!door) return { x: room.width / 2, z: room.length - 0.25, yaw: Math.PI }
    const mid = door.offset + door.width / 2
    // Стоим в дверном проёме, лицом в зал
    if (door.wall === "top") return { x: mid, z: 0.25, yaw: 0 }
    if (door.wall === "bottom") return { x: mid, z: room.length - 0.25, yaw: Math.PI }
    if (door.wall === "left") return { x: 0.25, z: mid, yaw: Math.PI / 2 }
    return { x: room.width - 0.25, z: mid, yaw: -Math.PI / 2 }
  }

  setMode(m: ViewMode) {
    this.mode = m
    this.ceilingGroup.visible = m === "walk"
    this.controls.enabled = m === "orbit"
    if (m === "walk") this.enterWalk()
    else this.preset("corner")
  }

  private enterWalk() {
    const e = this.entrance()
    this.camera.position.set(e.x, 1.62, e.z)
    // Смотрим внутрь зала: yaw 0 — вдоль +z
    this.yaw = e.yaw
    this.pitch = -0.12
    this.applyLook()
  }

  private applyLook() {
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))
    this.camera.lookAt(this.camera.position.clone().add(dir))
  }

  /** Снимок одной единицы оборудования спереди — картинка для задания консультанту */
  shot(id: string, w = 960, h = 640): string | null {
    const g = this.itemCache.get(id)?.group
    if (!g || !this.room) return null
    const box = new THREE.Box3().setFromObject(g, true)
    const c = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion).setY(0).normalize()
    const cam = new THREE.PerspectiveCamera(42, w / h, 0.05, 100)
    const dist = Math.max(size.x, size.z, size.y * 0.9) * 1.25 + 0.9
    cam.position.copy(c).addScaledVector(front, dist).setY(Math.max(1.2, c.y + 0.35))
    // Не выходим за стены зала
    cam.position.x = Math.min(this.room.width - 0.1, Math.max(0.1, cam.position.x))
    cam.position.z = Math.min(this.room.length - 0.1, Math.max(0.1, cam.position.z))
    cam.lookAt(c)
    const sel = this.selBox
    if (sel) sel.visible = false
    const walls = Object.values(this.walls).map((wg) => wg.visible)
    Object.values(this.walls).forEach((wg) => (wg.visible = true))
    const prev = this.renderer.getPixelRatio()
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.renderer.render(this.scene, cam)
    const url = this.renderer.domElement.toDataURL("image/jpeg", 0.82)
    this.renderer.setPixelRatio(prev)
    this.resize()
    Object.values(this.walls).forEach((wg, i) => (wg.visible = walls[i]))
    if (sel) sel.visible = true
    return url
  }

  /**
   * Фотореалистичный снимок текущего вида: трассировка лучей (свет отражается от стен и вещей, мягкие тени).
   * Считается в браузере на видеокарте: 20–90 секунд. Возвращает PNG.
   */
  async photo(onProgress?: (p: number, stage: "prepare" | "render") => void, samples = 300, maxMs = 120000): Promise<string> {
    if (this.photoBusy) throw new Error("Снимок уже делается")
    this.photoBusy = true
    const was = { zones: this.zonesGroup.visible, sel: this.selBox?.visible ?? false, ctl: this.controls.enabled }
    let cleanup = () => {}
    let pt: { dispose: () => void } | null = null
    try {
      onProgress?.(0, "prepare")
      const { WebGLPathTracer, DenoiseMaterial } = await import("three-gpu-pathtracer")
      this.zonesGroup.visible = false
      if (this.selBox) this.selBox.visible = false
      this.controls.enabled = false
      const built = this.photoScene()
      cleanup = built.dispose
      const tracer = new WebGLPathTracer(this.renderer)
      pt = tracer
      tracer.tiles.set(2, 2)
      // Все текстуры (кирпич, плёнка, ткани) складываются в один массив — 512 px хватает и экономит память
      tracer.textureSize.set(512, 512)
      tracer.bounces = 5
      tracer.filterGlossyFactor = 0.5
      tracer.minSamples = 1
      tracer.renderDelay = 0
      tracer.fadeDuration = 0
      tracer.rasterizeScene = false
      await new Promise((r) => setTimeout(r, 30))
      // Сборка сцены для трассировки — за один раз (несколько секунд, страница на это время замирает)
      tracer.setScene(built.scene, this.camera)
      const t0 = performance.now()
      await new Promise<void>((resolve) => {
        const step = () => {
          tracer.renderSample()
          onProgress?.(Math.min(1, tracer.samples / samples), "render")
          if (tracer.samples >= samples || performance.now() - t0 > maxMs) resolve()
          else requestAnimationFrame(step)
        }
        step()
      })
      // Остаток шума — сглаживаем с сохранением краёв
      const dn = new DenoiseMaterial({ map: tracer.target.texture, blending: THREE.NoBlending, premultipliedAlpha: this.renderer.getContextAttributes()?.premultipliedAlpha })
      dn.uniforms.sigma.value = 5
      dn.uniforms.kSigma.value = 1.5
      dn.uniforms.threshold.value = 0.1
      const quad = new FullScreenQuad(dn)
      this.renderer.setRenderTarget(null)
      quad.render(this.renderer)
      const url = this.renderer.domElement.toDataURL("image/png")
      quad.dispose()
      dn.dispose()
      return url
    } finally {
      try { pt?.dispose() } catch { /* трассировщик не успел создаться до конца */ }
      cleanup()
      this.zonesGroup.visible = was.zones
      if (this.selBox) this.selBox.visible = was.sel
      this.controls.enabled = was.ctl && this.mode === "orbit"
      this.photoBusy = false
    }
  }

  /**
   * Сцена для трассировщика: он не понимает «пачки» одинаковых вещей (InstancedMesh), поэтому каждая пачка
   * склеивается в одну модель с цветом в вершинах. Прожекторы на треках становятся настоящими источниками света.
   */
  private photoScene(): { scene: THREE.Scene; dispose: () => void } {
    const ps = new THREE.Scene()
    ps.background = this.scene.background
    // Трассировщику нужна панорама (equirect), а не кубическая карта: светлый потолок, стены, тёмный пол
    const W = 128, H = 64
    const env = new Float32Array(W * H * 4)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = 1 - y / (H - 1)
      const k = v > 0.5 ? 0.75 + 0.5 * (v - 0.5) : 0.25 + 0.9 * v
      const i = (y * W + x) * 4
      env[i] = k; env[i + 1] = k * 0.97; env[i + 2] = k * 0.92; env[i + 3] = 1
    }
    const envTex = new THREE.DataTexture(env, W, H, THREE.RGBAFormat, THREE.FloatType)
    envTex.mapping = THREE.EquirectangularReflectionMapping
    envTex.needsUpdate = true
    ps.environment = envTex
    ps.environmentIntensity = 0.8
    const made: THREE.BufferGeometry[] = []
    const mats: THREE.Material[] = []
    this.scene.updateMatrixWorld(true)
    // Текстуры в трассировщике ведут себя по-разному на разных видеокартах — заменяем их средним цветом
    const conv = new Map<THREE.Material, THREE.Material>()
    const flat = (src: THREE.Material): THREE.Material => {
      const hit = conv.get(src)
      if (hit) return hit
      const m = src.clone() as THREE.MeshStandardMaterial
      if (m.map) {
        const avg = averageColor(m.map)
        if (avg) m.color.multiply(avg)
      }
      // Сетка «в клеточку» без карты прозрачности — полупрозрачный металл
      if (m.alphaMap) { m.transparent = true; m.opacity = 0.35; m.alphaTest = 0 }
      for (const k of ["map", "normalMap", "alphaMap", "roughnessMap", "metalnessMap", "emissiveMap", "bumpMap"] as const) (m as unknown as Record<string, unknown>)[k] = null
      conv.set(src, m)
      conv.set(m, m)
      mats.push(m)
      return m
    }
    const place = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], m: THREE.Matrix4): void => {
      // Несколько материалов на гранях (блоки: кирпич по бокам, тёмный верх) — на отдельные детали по граням
      if (Array.isArray(mat)) {
        if (!geo.index || !geo.groups.length) { place(geo, mat[0], m); return }
        for (const gr of geo.groups) {
          const part = subGeometry(geo, Array.from(geo.index.array.slice(gr.start, gr.start + gr.count)))
          made.push(part)
          place(part, mat[gr.materialIndex ?? 0], m)
        }
        return
      }
      // Трассировщик записывает номер материала прямо в геометрию — общая геометрия (трубы, коробки)
      // досталась бы всем с одним материалом. Каждой детали — своя копия только с нужными атрибутами;
      // у одноматериальных — без разметки граней
      if (!made.includes(geo)) {
        geo = geo.clone()
        made.push(geo)
      }
      cleanAttributes(geo)
      geo.clearGroups()
      const mesh = new THREE.Mesh(geo, flat(mat))
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(m)
      ps.add(mesh)
    }
    const lamps: THREE.Object3D[] = []
    this.scene.traverseVisible((o) => {
      if (o.userData.lamp) lamps.push(o)
      const im = o as THREE.InstancedMesh
      if (im.isInstancedMesh) {
        if (!im.count) return
        const list: THREE.BufferGeometry[] = []
        const m = new THREE.Matrix4(), c = new THREE.Color()
        for (let i = 0; i < im.count; i++) {
          im.getMatrixAt(i, m)
          const g = im.geometry.clone()
          for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k)
          cleanAttributes(g)
          g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(im.matrixWorld, m))
          if (im.instanceColor) {
            im.getColorAt(i, c)
            const n = g.attributes.position.count
            // Цвет вершин — RGBA: так его ждёт трассировщик
            const col = new Float32Array(n * 4)
            for (let k = 0; k < n; k++) { col[k * 4] = c.r; col[k * 4 + 1] = c.g; col[k * 4 + 2] = c.b; col[k * 4 + 3] = 1 }
            g.setAttribute("color", new THREE.BufferAttribute(col, 4))
          }
          list.push(g)
        }
        const merged = mergeGeometries(list, false)
        list.forEach((g) => g.dispose())
        if (!merged) return
        made.push(merged)
        const mat = flat(im.material as THREE.Material).clone()
        if (im.instanceColor) (mat as THREE.MeshStandardMaterial).vertexColors = true
        conv.set(mat, mat)
        mats.push(mat)
        place(merged, mat, new THREE.Matrix4())
        return
      }
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && !(mesh.material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) place(mesh.geometry, mesh.material, mesh.matrixWorld)
    })
    // Солнце через мансардные окна — мягче, свет в зале — от прожекторов
    const sun = this.sun.clone()
    sun.intensity = this.sun.intensity * 0.5
    ps.add(sun, sun.target)
    sun.target.position.copy(this.sun.target.position)
    const p = new THREE.Vector3()
    for (const l of lamps) {
      l.getWorldPosition(p)
      const s = new THREE.SpotLight("#fff1dc", 22, 12, 0.7, 0.7, 2)
      s.position.copy(p).add(new THREE.Vector3(0, -0.03, 0))
      s.target.position.copy(p).add(new THREE.Vector3(0, -3, 0))
      ps.add(s, s.target)
    }
    ps.updateMatrixWorld(true)
    return { scene: ps, dispose: () => { made.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); envTex.dispose() } }
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL("image/png")
  }

  private tick() {
    const dt = Math.min(0.05, this.clock.getDelta())
    if (this.photoBusy) return
    if (this.mode === "walk" && this.room) {
      const f = (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) - (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0)
      const s = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0)
      const turn = (this.keys.has("arrowleft") ? 1 : 0) - (this.keys.has("arrowright") ? 1 : 0)
      if (turn) { this.yaw += turn * dt * 1.6; this.applyLook() }
      if (f || s) this.walkBy(f * dt * 1.8, s * dt * 1.4)
    } else {
      // WASD — сдвинуть точку обзора по залу; двойной клик — плавно перелететь
      const f = (this.keys.has("w") ? 1 : 0) - (this.keys.has("s") ? 1 : 0)
      const sd = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0)
      if (f || sd) {
        this.fly = null
        const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).setY(0)
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)
        dir.normalize()
        const right = new THREE.Vector3(-dir.z, 0, dir.x)
        const speed = Math.max(2, this.camera.position.distanceTo(this.controls.target) * 0.6) * dt
        this.panBy(dir.multiplyScalar(f * speed).add(right.multiplyScalar(sd * speed)))
      }
      if (this.fly) {
        const k = 1 - Math.pow(0.0005, dt)
        const dT = this.fly.target.clone().sub(this.controls.target).multiplyScalar(k)
        this.controls.target.add(dT)
        this.camera.position.add(this.fly.cam.clone().sub(this.camera.position).multiplyScalar(k))
        if (this.controls.target.distanceTo(this.fly.target) < 0.01) this.fly = null
      }
      this.clampTarget()
      this.controls.update()
      // «Кукольный домик»: стены между камерой и залом прячем
      if (this.room) {
        const p = this.camera.position
        this.walls.top.visible = p.z > -0.1
        this.walls.bottom.visible = p.z < this.room.length + 0.1
        this.walls.left.visible = p.x > -0.1
        this.walls.right.visible = p.x < this.room.width + 0.1
      }
    }
    if (this.mode === "walk") for (const g of Object.values(this.walls)) g.visible = true
    this.renderer.render(this.scene, this.camera)
  }

  private walkBy(forward: number, side: number) {
    const room = this.room!
    const p = this.camera.position
    p.x += Math.sin(this.yaw) * forward - Math.cos(this.yaw) * side
    p.z += Math.cos(this.yaw) * forward + Math.sin(this.yaw) * side
    p.x = Math.min(room.width - 0.3, Math.max(0.3, p.x))
    p.z = Math.min(room.length - 0.3, Math.max(0.3, p.z))
    this.applyLook()
  }

  // ── Мышь: выбор и перетаскивание оборудования, взгляд при обходе ──

  private pointer(e: PointerEvent | WheelEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  }

  private floorPoint(e: PointerEvent) {
    this.ray.setFromCamera(this.pointer(e), this.camera)
    const p = new THREE.Vector3()
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    if (this.mode === "walk") { this.look = { x: e.clientX, y: e.clientY }; return }
    this.ray.setFromCamera(this.pointer(e), this.camera)
    const hits = this.ray.intersectObjects(this.itemsGroup.children, true)
    let o: THREE.Object3D | null = hits[0]?.object ?? null
    while (o && !o.userData.id) o = o.parent
    if (!o) { this.cb.onSelect(null); return }
    const id = o.userData.id as string
    this.cb.onSelect(id)
    // Закреплённое только выделяется, мышь крутит камеру
    if (this.fixedIds.has(id)) return
    const fp = this.floorPoint(e)
    if (!fp) return
    const group = o as THREE.Group
    this.drag = { id, group, dx: group.position.x - fp.x, dz: group.position.z - fp.z, moved: false }
    this.controls.enabled = false
  }

  private onMoveEv = (e: PointerEvent) => {
    if (this.look) {
      this.yaw -= (e.clientX - this.look.x) * 0.004
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - (e.clientY - this.look.y) * 0.004))
      this.look = { x: e.clientX, y: e.clientY }
      this.applyLook()
      return
    }
    if (!this.drag) return
    const fp = this.floorPoint(e)
    if (!fp || !this.room) return
    const snap = (v: number) => Math.round(v / 0.01) * 0.01
    this.drag.group.position.x = Math.min(this.room.width, Math.max(0, snap(fp.x + this.drag.dx)))
    this.drag.group.position.z = Math.min(this.room.length, Math.max(0, snap(fp.z + this.drag.dz)))
    this.drag.moved = true
    this.updateSelectionBox()
  }

  private updateSelectionBox() {
    if (!this.selBox || !this.drag) return
    this.selBox.box.setFromObject(this.drag.group, true)
  }

  private onUp = () => {
    this.look = null
    if (!this.drag) return
    const { id, group, moved } = this.drag
    this.drag = null
    this.controls.enabled = this.mode === "orbit"
    if (moved) this.cb.onMove(id, Math.round(group.position.x * 100) / 100, Math.round(group.position.z * 100) / 100)
  }

  /** Сдвинуть камеру и точку обзора вместе */
  private panBy(v: THREE.Vector3) {
    this.controls.target.add(v)
    this.camera.position.add(v)
  }

  /** Точка обзора не уходит за пределы зала (с запасом 1 м) */
  private clampTarget() {
    if (!this.room) return
    const t = this.controls.target
    const nx = Math.min(this.room.width + 1, Math.max(-1, t.x)), nz = Math.min(this.room.length + 1, Math.max(-1, t.z)), ny = Math.min(3, Math.max(0, t.y))
    if (nx !== t.x || ny !== t.y || nz !== t.z) this.panBy(new THREE.Vector3(nx - t.x, ny - t.y, nz - t.z))
  }

  /** Двойной клик: точка обзора — туда, куда кликнули (оборудование или пол), камера летит следом */
  private onDbl = (e: MouseEvent) => {
    if (this.mode !== "orbit") return
    this.ray.setFromCamera(this.pointer(e as PointerEvent), this.camera)
    const hit = this.ray.intersectObjects(this.itemsGroup.children, true)[0]?.point ?? this.floorPoint(e as PointerEvent)
    if (!hit) return
    const target = new THREE.Vector3(hit.x, Math.min(1.2, Math.max(0.3, hit.y)), hit.z)
    // Камера подлетает ближе (на 60 % расстояния, но не ближе 3 м), направление взгляда сохраняется
    const off = this.camera.position.clone().sub(this.controls.target)
    off.setLength(Math.max(3, off.length() * 0.6))
    this.fly = { target, cam: target.clone().add(off) }
  }

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== "walk") return
    e.preventDefault()
    this.walkBy(-e.deltaY * 0.003, 0)
  }

  private onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.ctrlKey || e.metaKey) return
    // 3D не на экране (вкладка «План») — клавиши не перехватываем
    if (!this.renderer.domElement.isConnected || !this.renderer.domElement.offsetParent) return
    const k = e.key.toLowerCase()
    const map: Record<string, string> = { "ц": "w", "ы": "s", "ф": "a", "в": "d" }
    const key = map[k] ?? k
    // В обзоре стрелки двигают выбранное оборудование — камере только WASD
    if (this.mode !== "walk" && key.startsWith("arrow")) return
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      this.keys.add(key)
      e.preventDefault()
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    const map: Record<string, string> = { "ц": "w", "ы": "s", "ф": "a", "в": "d" }
    this.keys.delete(map[k] ?? k)
  }
}
