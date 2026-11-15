/**
 * Раскладка товаров по оборудованию зала (ТЗ: docs/merch-tz.md). Чистые функции без базы — работают и в админке
 * (кнопка «Разложить товары»), и в тестах.
 *
 * Как раскладывает:
 * 1. Порядок: сначала штанги (стойки, пристенные системы), потом полки и столы, последними — манекены:
 *    полки и столы продолжают бренд соседней стойки, манекен одевается из соседних стоек.
 * 2. Сильные места первыми: сила = звёзды зоны + близость ко входу. Туда — товары с самым высоким баллом.
 * 3. Одна стойка — один бренд («брендовый блок»); второй — если первый занял меньше 70 %. Повтор бренда штрафуется,
 *    якорные бренды — без штрафа на первых двух местах. Люкс не ставится вплотную к bridge, одинаковый стиль — рядом.
 * 4. Плотность и число размеров — по уровню бренда (bridge / премиум / люкс), в фокус-зоне — реже.
 * 5. Внутри бренда — капсулы: главная вещь (лицом вперёд) → верхняя одежда → средний слой → первый слой → низ,
 *    в капсуле цвет главной вещи + нейтральные; внутри слоя — от светлого к тёмному, модели разных цветов рядом.
 * 6. Роли зон: «вход» — только столы, подиумы и манекены; «касса» — недорогие аксессуары; «распродажа» — Outlet.
 * 7. Закреплённое оборудование не трогается; у оборудования можно ограничить категории и бренды.
 */

export type MProduct = {
  id: string
  title: string
  brand: string | null
  cat: string | null
  sub: string | null
  color: string | null
  thumb: string | null
  sizes: string[]
  score: number
  price: number
  units: number
  warmth?: string | null
  /** Модель без цвета — разные цвета одной модели висят рядом */
  model?: string | null
  /** Новинка: пришла недавно или отмечена вручную */
  fresh?: boolean
  /** Outlet — вещь с дефектом / уценка */
  outlet?: boolean
}

export type Place = "rail" | "shelf"
/** Товар на оборудовании: n — вешалок (на штанге) или мест (на полке/столе); face — лицом вперёд */
export type Slot = { p: string; n: number; place: Place; face?: boolean }
export type Assign = Record<string, Slot[]>

export type ZoneRole = "entry" | "focus" | "wall" | "center" | "cash" | "fitting" | "back" | "sale"
export type EquipLike = { id: string; type: string; x: number; y: number; w: number; d: number; h: number; lock?: boolean; cats?: string[]; brands?: string[] }
export type ZoneLike = { x: number; y: number; w: number; d: number; power: number; role?: ZoneRole | null; name?: string }
export type RoomLike = { width: number; length: number; openings: { kind: string; wall: string; offset: number; width: number }[] }

// ── Правила выкладки (раздел «Правила» в админке) ──

export type Level = "bridge" | "premium" | "luxury"
export type LevelRule = {
  /** Вешалок на метр штанги */
  hang_per_m: number
  /** Сколько размеров одной модели вешать */
  max_sizes: number
  /** Каждая N-я модель лицом вперёд (0 — только главная вещь капсулы) */
  face_every: number
  /** Сколько «мест» на полке/столе занимает одна вещь (люкс — просторнее) */
  shelf_cost: number
}
export type BrandRule = { level: Level; style?: string | null; anchor?: boolean }
export type MerchSettings = {
  levels: Record<Level, LevelRule>
  brands: Record<string, BrandRule>
  default_level: Level
  /** Во сколько раз реже вешать в фокус-зоне (0,75 — на четверть реже) */
  focus_density: number
  /** Выставлять последнюю единицу товара (склад общий с сайтом — её могут купить онлайн) */
  last_unit: boolean
}

export const LEVEL_NAME: Record<Level, string> = { bridge: "Bridge / middle", premium: "Премиум", luxury: "Люкс" }
export const ZONE_ROLE_NAME: Record<ZoneRole, string> = {
  entry: "Вход (адаптация)", focus: "Фокус", wall: "Сильная стена", center: "Центр", cash: "Касса",
  fitting: "У примерочных", back: "Дальняя зона", sale: "Распродажа",
}

export const DEFAULT_SETTINGS: MerchSettings = {
  levels: {
    bridge: { hang_per_m: 16, max_sizes: 5, face_every: 0, shelf_cost: 1 },
    premium: { hang_per_m: 12, max_sizes: 4, face_every: 0, shelf_cost: 1.2 },
    luxury: { hang_per_m: 7, max_sizes: 1, face_every: 3, shelf_cost: 1.6 },
  },
  brands: {},
  default_level: "premium",
  focus_density: 0.75,
  last_unit: true,
}

export function mergeSettings(raw: Partial<MerchSettings> | null | undefined): MerchSettings {
  const r = raw ?? {}
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    levels: {
      bridge: { ...DEFAULT_SETTINGS.levels.bridge, ...(r.levels?.bridge ?? {}) },
      premium: { ...DEFAULT_SETTINGS.levels.premium, ...(r.levels?.premium ?? {}) },
      luxury: { ...DEFAULT_SETTINGS.levels.luxury, ...(r.levels?.luxury ?? {}) },
    },
    brands: { ...(r.brands ?? {}) },
  }
}

export function validateSettings(raw: unknown): MerchSettings {
  const s = mergeSettings(raw as Partial<MerchSettings>)
  const num = (v: unknown, min: number, max: number, what: string) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`${what}: от ${min} до ${max}`)
  }
  for (const l of ["bridge", "premium", "luxury"] as Level[]) {
    const r = s.levels[l]
    num(r.hang_per_m, 3, 30, `${LEVEL_NAME[l]}: вешалок на метр`)
    num(r.max_sizes, 1, 8, `${LEVEL_NAME[l]}: размеров модели`)
    num(r.face_every, 0, 20, `${LEVEL_NAME[l]}: лицом вперёд`)
    num(r.shelf_cost, 0.5, 4, `${LEVEL_NAME[l]}: места на полке`)
  }
  num(s.focus_density, 0.3, 1, "Плотность в фокус-зоне")
  if (!["bridge", "premium", "luxury"].includes(s.default_level)) throw new Error("Неверный уровень по умолчанию")
  for (const [b, r] of Object.entries(s.brands)) {
    if (!["bridge", "premium", "luxury"].includes(r.level)) throw new Error(`Бренд ${b}: неверный уровень`)
    s.brands[b] = { level: r.level, style: r.style ? String(r.style).slice(0, 40) : null, anchor: !!r.anchor }
  }
  s.last_unit = !!s.last_unit
  return s
}

// ── Оборудование ──

export const HANG_CATS = ["kurtki", "svitery-i-kardigany", "hudi-i-svitshoty", "rubashki-i-polo", "futbolki-i-longslivy", "bryuki", "dzhinsy", "shorty"]
const SHELF_CATS = ["sumki-i-ryukzaki", "golovnye-ubory", "aksessuary"]
const TABLE_CATS = ["futbolki-i-longslivy", "svitery-i-kardigany", "hudi-i-svitshoty", "golovnye-ubory", "sumki-i-ryukzaki", "aksessuary", "nizhnee-bele-i-noski"]
const WALL_SHELF_CATS = ["golovnye-ubory", "futbolki-i-longslivy", "aksessuary", "svitery-i-kardigany"]
/** Импульсные покупки у кассы */
const CASH_CATS = ["aksessuary", "nizhnee-bele-i-noski", "golovnye-ubory"]

export const CAT_NAME: Record<string, string> = {
  kurtki: "Куртки", "svitery-i-kardigany": "Свитеры", "hudi-i-svitshoty": "Худи и свитшоты", "rubashki-i-polo": "Рубашки и поло",
  "futbolki-i-longslivy": "Футболки и лонгсливы", bryuki: "Брюки", dzhinsy: "Джинсы", shorty: "Шорты", obuv: "Обувь",
  "sumki-i-ryukzaki": "Сумки и рюкзаки", "golovnye-ubory": "Головные уборы", aksessuary: "Аксессуары", "nizhnee-bele-i-noski": "Бельё и носки",
}

/**
 * Что помещается на оборудование. rail — вешалок при базовой плотности 15 на метр (для подсказок в админке),
 * railM — метров штанги (по ним считает раскладка, плотность зависит от уровня бренда), shelf — мест на полках/столе.
 */
export type Capacity = { rail: number; railM: number; shelf: number; railCats: string[]; shelfCats: string[] }

const perLen = (len: number, step: number) => Math.max(1, Math.floor(len / step))

export function capacityOf(e: EquipLike): Capacity {
  const none: Capacity = { rail: 0, railM: 0, shelf: 0, railCats: [], shelfCats: [] }
  const rail = (m: number, extra: Partial<Capacity> = {}): Capacity => ({ ...none, rail: Math.round(m * 15), railM: m, railCats: HANG_CATS, ...extra })
  switch (e.type) {
    case "wall_system": return rail(e.w, { shelf: perLen(e.w, 0.45), shelfCats: ["sumki-i-ryukzaki", "golovnye-ubory"] })
    case "rack_base":
    case "rack_pipe": return rail(e.w)
    case "rack_pipe_double": return rail(e.w * 2)
    case "round_rack": return rail(Math.PI * e.w * 0.8)
    case "shoe_rack": return { ...none, shelf: Math.max(2, Math.round(e.h / 0.4)) * perLen(e.w, 0.45), shelfCats: ["obuv"] }
    case "cabinet": return { ...none, shelf: 3 * perLen(e.w, 0.35), shelfCats: SHELF_CATS }
    case "wall_shelves": return { ...none, shelf: 5 * perLen(e.w, 0.35), shelfCats: SHELF_CATS }
    case "grid_panel": return { ...none, shelf: Math.max(2, Math.floor((e.w * e.h) / 0.25)), shelfCats: ["sumki-i-ryukzaki"] }
    case "wall_shelf":
    case "wall_shelf_s": return { ...none, shelf: e.w >= 0.55 ? 2 : 1, shelfCats: WALL_SHELF_CATS }
    case "table_cube":
    case "table_white": return { ...none, shelf: Math.min(8, Math.max(1, Math.floor((e.w * e.d) / 0.2))), shelfCats: TABLE_CATS }
    case "podium": return { ...none, shelf: 1, shelfCats: ["obuv", "sumki-i-ryukzaki", "golovnye-ubory"] }
    case "mannequin": return { ...none, rail: 3, railM: 0.2, railCats: HANG_CATS }
    default: return none
  }
}

/** Слои образа на штанге: верхняя одежда → средний слой → первый слой → низ */
const LAYER: Record<string, number> = {
  kurtki: 0, "svitery-i-kardigany": 1, "hudi-i-svitshoty": 1, "rubashki-i-polo": 2, "futbolki-i-longslivy": 2, bryuki: 3, dzhinsy: 3, shorty: 3,
}
const layerOf = (c: string | null) => LAYER[c ?? ""] ?? 4

/** Нейтральные цвета — подходят в любую капсулу */
const NEUTRAL = new Set(["black", "white", "grey", "beige"])

/** Светлота цвета для градиента «от светлого к тёмному» */
export const COLOR_LIGHT: Record<string, number> = {
  white: 0.97, beige: 0.85, "light-blue": 0.78, yellow: 0.75, pink: 0.72, grey: 0.6, orange: 0.58, multi: 0.5, khaki: 0.48,
  red: 0.45, green: 0.4, purple: 0.36, blue: 0.32, brown: 0.3, burgundy: 0.24, black: 0.04,
}
/** Цвет вещи в 3D */
export const COLOR_HEX: Record<string, string> = {
  white: "#ecebe6", black: "#141414", blue: "#26344f", grey: "#8a8d91", beige: "#d9cdb8", green: "#3f5a40", "light-blue": "#9cb9d8",
  multi: "#8a7a6a", khaki: "#6b6a45", red: "#b3302f", pink: "#e3a3b5", brown: "#6a4a35", burgundy: "#6e1f2c", orange: "#d4682c",
  yellow: "#e3c34a", purple: "#6b4f8a",
}
const light = (c: string | null) => COLOR_LIGHT[c ?? ""] ?? 0.5

/** Вид вещи в 3D по категории */
export function kindOf(cat: string | null, place: Place): "tee" | "hoodie" | "jacket" | "pants" | "fold" | "shoe" | "bag" | "cap" {
  if (cat === "obuv") return "shoe"
  if (cat === "sumki-i-ryukzaki" || cat === "aksessuary" || cat === "nizhnee-bele-i-noski") return "bag"
  if (cat === "golovnye-ubory") return "cap"
  if (place === "shelf") return "fold"
  if (cat === "kurtki") return "jacket"
  if (cat === "hudi-i-svitshoty" || cat === "svitery-i-kardigany") return "hoodie"
  if (cat === "bryuki" || cat === "dzhinsy" || cat === "shorty") return "pants"
  return "tee"
}

/** Зона, в которой стоит оборудование (сильнейшая из пересекающихся) */
export function zoneOf(e: { x: number; y: number }, zones: ZoneLike[]): ZoneLike | null {
  const inZone = zones.filter((z) => e.x >= z.x && e.x <= z.x + z.w && e.y >= z.y && e.y <= z.y + z.d)
  return inZone.sort((a, b) => b.power - a.power)[0] ?? null
}

/** Сила места: звёзды зоны (по умолчанию 2) + до 2 за близость ко входу */
export function strengthOf(e: EquipLike, zones: ZoneLike[], room: RoomLike): number {
  const z = zoneOf(e, zones)
  const power = z ? z.power : 2
  const door = room.openings.find((o) => o.kind === "door")
  if (!door) return power
  const mid = door.offset + door.width / 2
  const pt = door.wall === "top" ? [mid, 0] : door.wall === "bottom" ? [mid, room.length] : door.wall === "left" ? [0, mid] : [room.width, mid]
  const dist = Math.hypot(e.x - pt[0], e.y - pt[1])
  const diag = Math.hypot(room.width, room.length) || 1
  return power + 2 * (1 - Math.min(1, dist / diag))
}

export const levelOf = (p: MProduct, s: MerchSettings): Level => s.brands[p.brand ?? ""]?.level ?? s.default_level

/** Вешалок на модель: по числу размеров в наличии, но не больше нормы уровня; последний размер — одна вешалка */
export function facingsOf(p: MProduct, place: Place, s: MerchSettings = DEFAULT_SETTINGS): number {
  if (place === "shelf") return 1
  return Math.min(s.levels[levelOf(p, s)].max_sizes, Math.max(1, p.sizes.length))
}

/**
 * Капсулы: главная вещь (самый высокий балл) + вещи её цвета и нейтральные. Внутри капсулы — по слоям,
 * в слое — модели разных цветов рядом, от светлого к тёмному. Главная вещь — лицом вперёд.
 */
export function capsules(list: MProduct[]): MProduct[][] {
  const left = [...list].sort((a, b) => b.score - a.score)
  const out: MProduct[][] = []
  while (left.length) {
    const lead = left.shift()!
    const palette = new Set([lead.color ?? "", ...NEUTRAL])
    const members = [lead]
    for (let i = 0; i < left.length && members.length < 12; ) {
      if (palette.has(left[i].color ?? "")) members.push(...left.splice(i, 1))
      else i++
    }
    // Капсула из 1–2 вещей не держит историю — добираем ближайшими по баллу
    while (members.length < 3 && left.length) members.push(left.shift()!)
    const rest = members.slice(1).sort((a, b) => layerOf(a.cat) - layerOf(b.cat) || (a.model ?? a.id).localeCompare(b.model ?? b.id) || light(b.color) - light(a.color))
    out.push([lead, ...rest])
  }
  return out
}

/** Порядок на штанге/полке: капсулы по брендам (для ручных правок — просто по слоям и светлоте) */
export function orderSlots(slots: Slot[], byId: Map<string, MProduct>): Slot[] {
  return [...slots].sort((a, b) => {
    const pa = byId.get(a.p), pb = byId.get(b.p)
    if (!pa || !pb) return 0
    if (a.place !== b.place) return a.place === "rail" ? -1 : 1
    if ((pa.brand ?? "") !== (pb.brand ?? "")) return 0
    return layerOf(pa.cat) - layerOf(pb.cat) || light(pb.color) - light(pa.color)
  })
}

export type AutofillOpts = { onlyEmpty?: boolean; settings?: MerchSettings }

const RAIL_TYPES = new Set(["wall_system", "rack_base", "rack_pipe", "rack_pipe_double", "round_rack"])
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

export function autofill(items: EquipLike[], zones: ZoneLike[], room: RoomLike, products: MProduct[], current: Assign, opts: AutofillOpts = {}): Assign {
  const S = opts.settings ?? DEFAULT_SETTINGS
  const byId = new Map(products.map((p) => [p.id, p]))
  const placed = new Set<string>()
  const result: Assign = {}
  // Закреплённое (и при «только пустое» — уже заполненное) остаётся как есть
  for (const e of items) {
    const cur = current[e.id] ?? []
    if (e.lock || (opts.onlyEmpty && cur.length)) {
      result[e.id] = cur
      cur.forEach((s) => placed.add(s.p))
    }
  }
  const avail = products
    .filter((p) => p.sizes.length > 0 && !placed.has(p.id) && (S.last_unit || p.units > 1))
    .sort((a, b) => b.score - a.score)
  const brandOf = (id: string) => byId.get(id)?.brand ?? null
  const brandRule = (b: string | null) => S.brands[b ?? ""]
  const brandLevel = (b: string | null): Level => brandRule(b)?.level ?? S.default_level
  const brandUses = new Map<string, number>()
  const equipBrands = new Map<string, Set<string>>()
  for (const [id, sl] of Object.entries(result)) equipBrands.set(id, new Set(sl.map((s) => brandOf(s.p) ?? "—")))

  type Job = { e: EquipLike; cap: Capacity; s: number; zone: ZoneLike | null }
  const jobs: Job[] = items
    .filter((e) => !(e.id in result))
    .map((e) => ({ e, cap: capacityOf(e), s: strengthOf(e, zones, room), zone: zoneOf(e, zones) }))
    .filter((x) => x.cap.railM > 0 || x.cap.shelf > 0)

  /** Бренды соседнего оборудования (для полок, столов) */
  const neighbourBrands = (e: EquipLike, radius: number) => {
    const out = new Map<string, number>()
    for (const o of items) {
      if (o.id === e.id || dist(o, e) > radius) continue
      for (const b of equipBrands.get(o.id) ?? []) out.set(b, (out.get(b) ?? 0) + 1)
    }
    return out
  }
  const styleOf = (b: string) => brandRule(b)?.style ?? null

  const fits = (p: MProduct, e: EquipLike, cats: string[], zone: ZoneLike | null) => {
    if (placed.has(p.id) || !p.cat || !cats.includes(p.cat)) return false
    if (e.cats?.length && !e.cats.includes(p.cat)) return false
    if (e.brands?.length && !e.brands.includes(p.brand ?? "")) return false
    // Outlet — только в зоне распродажи, и в зоне распродажи — только Outlet
    if (zone?.role === "sale") return !!p.outlet
    if (p.outlet) return false
    if (zone?.role === "cash") return CASH_CATS.includes(p.cat)
    return true
  }

  /** Заполнить оборудование брендовыми блоками, капсулами внутри бренда */
  const fill = (job: Job, cats: string[], place: Place): Slot[] => {
    const { e, cap, zone } = job
    const density = zone?.role === "focus" ? S.focus_density : 1
    // Штанга считается в метрах (плотность — по уровню бренда), полки — в «местах»
    let left = place === "rail" ? cap.railM * density : cap.shelf
    const total = left
    const cost = (p: MProduct) => place === "rail"
      ? facingsOf(p, place, S) / S.levels[levelOf(p, S)].hang_per_m
      : S.levels[levelOf(p, S)].shelf_cost
    const near = place === "shelf" ? neighbourBrands(e, e.type.startsWith("table") ? 2.2 : 1.5) : neighbourBrands(e, 2.5)
    const out: Slot[] = []
    let blocks = 0
    // Новинки — в фокус: им двойной вес
    const weight = (p: MProduct) => Math.max(0.01, p.score) * (zone?.role === "focus" && p.fresh ? 2 : 1)
    while (left > 1e-6 && blocks < 3) {
      const pool = avail.filter((p) => fits(p, e, cats, zone))
      if (!pool.length) break
      const groups = new Map<string, MProduct[]>()
      for (const p of pool) groups.set(p.brand ?? "—", [...(groups.get(p.brand ?? "—") ?? []), p])
      let best: { brand: string; list: MProduct[]; value: number } | null = null
      for (const [brand, list] of groups) {
        let space = left, value = 0
        for (const p of list) {
          const c = cost(p)
          if (c > space + 1e-6) continue
          space -= c
          value += weight(p)
          if (space <= 1e-6) break
        }
        const uses = brandUses.get(brand) ?? 0
        const anchor = !!brandRule(brand)?.anchor
        value *= anchor && uses < 2 ? 1.2 : Math.pow(0.75, uses)
        if (place === "shelf") {
          // Полка и стол продолжают бренд соседней стойки, иначе — её стиль
          if (near.has(brand)) value *= 3
          else if (styleOf(brand) && [...near.keys()].some((b) => styleOf(b) === styleOf(brand))) value *= 1.5
        } else {
          const lv = brandLevel(brand)
          for (const nb of near.keys()) {
            const nl = brandLevel(nb)
            // Люкс вплотную к bridge — минус, одинаковый стиль — плюс
            if ((lv === "luxury" && nl === "bridge") || (lv === "bridge" && nl === "luxury")) value *= 0.5
            if (styleOf(brand) && styleOf(brand) === styleOf(nb)) value *= 1.15
          }
        }
        if (!best || value > best.value) best = { brand, list, value }
      }
      if (!best) break
      // На столе — не больше 3 цветов
      const colors = new Set<string>()
      const chosen: MProduct[] = []
      for (const p of best.list) {
        const c = cost(p)
        if (c > left + 1e-6) continue
        if (e.type.startsWith("table") && p.color && !colors.has(p.color) && colors.size >= 3) continue
        if (p.color) colors.add(p.color)
        chosen.push(p)
        placed.add(p.id)
        left -= c
        if (left <= 1e-6) break
      }
      const rule = S.levels[brandLevel(best.brand)]
      let k = 0
      for (const group of place === "rail" ? capsules(chosen) : [chosen]) {
        group.forEach((p, i) => {
          k++
          const face = place === "rail" && (i === 0 || (rule.face_every > 0 && k % rule.face_every === 0))
          out.push({ p: p.id, n: facingsOf(p, place, S), place, ...(face ? { face: true } : {}) })
        })
      }
      brandUses.set(best.brand, (brandUses.get(best.brand) ?? 0) + 1)
      equipBrands.set(e.id, new Set([...(equipBrands.get(e.id) ?? []), best.brand]))
      blocks++
      if (left <= total * 0.3) break
    }
    return out
  }

  const byStrength = (a: Job, b: Job) => b.s - a.s
  const rails = jobs.filter((j) => RAIL_TYPES.has(j.e.type)).sort(byStrength)
  const shelves = jobs.filter((j) => !RAIL_TYPES.has(j.e.type) && j.e.type !== "mannequin").sort(byStrength)
  const mannequins = jobs.filter((j) => j.e.type === "mannequin").sort(byStrength)

  // 1. Штанги. В зоне входа (адаптация) стойки не заполняются
  for (const job of rails) {
    if (job.zone?.role === "entry") continue
    const slots = fill(job, job.cap.railCats, "rail")
    if (job.cap.shelf > 0) slots.push(...fill(job, job.cap.shelfCats, "shelf"))
    if (slots.length) result[job.e.id] = slots
  }
  // 2. Полки, столы, стеллажи — с оглядкой на соседние стойки
  for (const job of shelves) {
    const slots = fill(job, job.cap.shelfCats, "shelf")
    if (slots.length) result[job.e.id] = slots
  }
  // 3. Манекены: образ одного бренда из вещей соседних стоек (в радиусе 2,5 м) — покупатель найдёт их рядом
  for (const { e } of mannequins) {
    const nearIds = items.filter((o) => o.id !== e.id && dist(o, e) <= 2.5).flatMap((o) => (result[o.id] ?? []).map((s) => byId.get(s.p)).filter(Boolean) as MProduct[])
    const pool = nearIds.length ? nearIds : avail
    const outers = pool.filter((p) => p.cat && ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany"].includes(p.cat) && p.sizes.length >= 2).sort((a, b) => b.score - a.score)
    for (const outer of outers) {
      const tee = pool.find((p) => p.brand === outer.brand && p.cat && ["futbolki-i-longslivy", "rubashki-i-polo"].includes(p.cat))
      const bottom = pool.find((p) => p.brand === outer.brand && p.cat && ["bryuki", "dzhinsy", "shorty"].includes(p.cat))
      if (!bottom) continue
      result[e.id] = [outer, ...(tee ? [tee] : []), bottom].map((p) => ({ p: p.id, n: 1, place: "rail" as Place }))
      break
    }
  }
  for (const e of items) if (!(e.id in result) && current[e.id]?.length && opts.onlyEmpty) result[e.id] = current[e.id]
  for (const k of Object.keys(result)) if (!result[k].length) delete result[k]
  return result
}

/** Заполненность: занято вешалок на штанге / мест на полках */
export function usedOf(slots: Slot[] | undefined) {
  const s = slots ?? []
  return { rail: s.filter((x) => x.place === "rail").reduce((a, x) => a + x.n, 0), shelf: s.filter((x) => x.place === "shelf").reduce((a, x) => a + x.n, 0) }
}

/** Норма вешалок на оборудовании при уровне бренда (для подсказки «занято X из Y») */
export function railCapacityFor(e: EquipLike, level: Level, s: MerchSettings = DEFAULT_SETTINGS) {
  return Math.round(capacityOf(e).railM * s.levels[level].hang_per_m)
}
