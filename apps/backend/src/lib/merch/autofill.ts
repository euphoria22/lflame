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
  /** Пол: men, women, unisex */
  gender?: string
  /** Новинка: пришла недавно или отмечена вручную */
  fresh?: boolean
  /** Outlet — вещь с дефектом / уценка */
  outlet?: boolean
  /** Роль товара по продажам магазина (lib/merch/offline.ts) */
  role?: "new" | "hit" | "hit_broken" | "second_chance" | "base" | "offseason" | "sale"
  /** Продано в магазине за 30 / 60 дней, запас в неделях, балл сайта (для сравнения) */
  q30?: number
  q60?: number
  weeks?: number | null
  site_score?: number
}

export type Place = "rail" | "shelf"
/** Товар на оборудовании: n — вешалок (на штанге) или мест (на полке/столе); face — лицом вперёд */
export type Slot = { p: string; n: number; place: Place; face?: boolean }
export type Assign = Record<string, Slot[]>

export type ZoneRole = "entry" | "focus" | "wall" | "center" | "cash" | "fitting" | "back" | "sale"
export type Side = "front" | "back" | "left" | "right"
export type EquipLike = { id: string; type: string; x: number; y: number; w: number; d: number; h: number; rot?: number; lock?: boolean; cats?: string[]; brands?: string[]; gender?: "men" | "women"; /** Закрытые стороны квадратной стойки */ closed?: Side[]; /** «Микс»: лучшие вещи разных брендов, без брендового блока */ mix?: boolean }
export type ZoneLike = { x: number; y: number; w: number; d: number; power: number; role?: ZoneRole | null; name?: string; /** Корнер бренда */ brands?: string[] }
export type RoomLike = { width: number; length: number; openings: { kind: string; wall: string; offset: number; width: number }[]; /** Вход, поставленный элементом на плане */ entrance?: { x: number; y: number } }

// ── Правила выкладки (раздел «Правила» в админке) ──

export type Level = "bridge" | "premium" | "luxury"
export type LevelRule = {
  /** Устарело: плотность теперь считается по вешалкам и толщине вещей (spacing) */
  hang_per_m?: number
  /** Запас между вещами: 1 — вплотную по толщине, 1,3 — на треть свободнее, 2 — вдвое */
  spacing: number
  /** Сколько размеров одной модели вешать */
  max_sizes: number
  /** Каждая N-я модель лицом вперёд (0 — только главная вещь капсулы) */
  face_every: number
  /** Сколько «мест» на полке/столе занимает одна вещь (люкс — просторнее) */
  shelf_cost: number
}
export type Hanger = { w: number; h: number; t: number }
export type BrandRule = { level: Level; style?: string | null; anchor?: boolean }
/** Образ или капсула, собранные мерчендайзером: ставятся первыми, остальное раскладывается вокруг */
export type Look = { id: string; name: string; place: "mannequin" | "table" | "rail"; products: string[]; active: boolean }
/** Повторяющийся чек-лист: по дням недели (0 — пн … 6 — вс) в заданное время приходит в рабочий чат */
export type Checklist = { id: string; name: string; items: string[]; days: number[]; time: string; enabled: boolean }
export type StandardKind = "all" | "rail" | "shelf" | "shoes" | "table"
/** Стандарты магазина — добавляются к шагам задания по типу оборудования */
export type Standards = Record<StandardKind, string[]>
export type MerchSettings = {
  levels: Record<Level, LevelRule>
  brands: Record<string, BrandRule>
  default_level: Level
  /** Во сколько раз реже вешать в фокус-зоне (0,75 — на четверть реже) */
  focus_density: number
  /** Выставлять последнюю единицу товара (склад общий с сайтом — её могут купить онлайн) */
  last_unit: boolean
  /** Вешалки магазина, см: для верха (w — ширина плечиков, h — высота, t — толщина) и для низа */
  hangers: { top: Hanger; bottom: Hanger }
  /** Толщина вещи на вешалке, см: верхняя одежда, средний слой (свитеры, худи), первый слой (футболки, рубашки), низ */
  garment_cm: { outer: number; mid: number; top: number; bottom: number }
  standards: Standards
  looks: Look[]
  checklists: Checklist[]
  /** Чем ранжировать товары: продажами магазина (офлайн-балл) или баллом сайта */
  score_source: "offline" | "site"
  /** План площади: доля стоек у бренда = доля в продажах магазина и в остатке (mix — вес продаж), shares — ручные доли, % */
  area_plan: { enabled: boolean; mix: number; shares: Record<string, number> }
  /** Довешивание: каждый день в time (Омск) — что продано вчера, принести со склада */
  replenish: { enabled: boolean; time: string }
}

export const LEVEL_NAME: Record<Level, string> = { bridge: "Bridge / middle", premium: "Премиум", luxury: "Люкс" }
export const ZONE_ROLE_NAME: Record<ZoneRole, string> = {
  entry: "Вход (адаптация)", focus: "Фокус", wall: "Сильная стена", center: "Центр", cash: "Касса",
  fitting: "У примерочных", back: "Дальняя зона", sale: "Распродажа",
}

export const DEFAULT_SETTINGS: MerchSettings = {
  levels: {
    bridge: { spacing: 1.1, max_sizes: 5, face_every: 0, shelf_cost: 1 },
    premium: { spacing: 1.4, max_sizes: 4, face_every: 0, shelf_cost: 1.2 },
    luxury: { spacing: 2.2, max_sizes: 1, face_every: 3, shelf_cost: 1.6 },
  },
  brands: {},
  default_level: "premium",
  focus_density: 0.75,
  last_unit: true,
  hangers: { top: { w: 44, h: 20, t: 1.5 }, bottom: { w: 30, h: 14, t: 2 } },
  garment_cm: { outer: 7, mid: 4.5, top: 2.5, bottom: 2.5 },
  standards: {
    all: ["Вещи отпарены, без складок от упаковки", "Ценник и бирки спрятаны внутрь, защитный датчик — в одном месте у всей категории"],
    rail: [
      "Одна модель — все размеры подряд, от меньшего к большему (S → XL)",
      "Вешалки одного вида, крючком в одну сторону; вещи лицом влево",
      "Пуговица или молния застёгнута на треть, капюшон расправлен",
      "Ровный шаг между моделями, штанга не забита: рука должна свободно двигаться",
    ],
    shelf: ["Сумки набиты бумагой, ремешки убраны внутрь", "Кепки — козырьком вперёд, по одной в ряд"],
    shoes: ["Выставляется левый ботинок, носком к покупателю, под небольшим углом", "Шнурки заправлены, бумага внутри"],
    table: ["Стопки по 3–5 штук, сгиб к покупателю, размеры снизу вверх — от большего к меньшему", "Не больше 3 цветов на столе, треть поверхности свободна"],
  },
  looks: [],
  score_source: "offline",
  area_plan: { enabled: false, mix: 0.5, shares: {} },
  replenish: { enabled: false, time: "11:00" },
  checklists: [
    { id: "morning", name: "Утренний обход", items: ["Свет и музыка включены", "Штанги ровные, размеры на месте после вчерашнего дня", "Отпарить вещи на манекенах и у входа", "Пыль на столах и полках", "Примерочные: зеркала, крючки, пустые вешалки убраны"], days: [0, 1, 2, 3, 4, 5, 6], time: "11:30", enabled: false },
    { id: "closing", name: "Закрытие", items: ["Вещи из примерочных развешаны на места", "Вешалки крючком в одну сторону", "Стопки на столах сложены заново", "Пустые вешалки убраны на склад"], days: [0, 1, 2, 3, 4, 5, 6], time: "20:45", enabled: false },
    { id: "delivery", name: "После поставки", items: ["Новая поставка отпарена", "Новинки вывешены по заданию мерчендайзера", "Коробки и плёнка убраны из зала", "Фото новинок в зале — в рабочий чат"], days: [], time: "15:00", enabled: false },
  ],
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
    hangers: { top: { ...DEFAULT_SETTINGS.hangers.top, ...(r.hangers?.top ?? {}) }, bottom: { ...DEFAULT_SETTINGS.hangers.bottom, ...(r.hangers?.bottom ?? {}) } },
    garment_cm: { ...DEFAULT_SETTINGS.garment_cm, ...(r.garment_cm ?? {}) },
    standards: { ...DEFAULT_SETTINGS.standards, ...(r.standards ?? {}) },
    looks: r.looks ?? [],
    area_plan: { ...DEFAULT_SETTINGS.area_plan, ...(r.area_plan ?? {}), shares: { ...(r.area_plan?.shares ?? {}) } },
    replenish: { ...DEFAULT_SETTINGS.replenish, ...(r.replenish ?? {}) },
    checklists: r.checklists ?? DEFAULT_SETTINGS.checklists,
  }
}

export function validateSettings(raw: unknown): MerchSettings {
  const s = mergeSettings(raw as Partial<MerchSettings>)
  const num = (v: unknown, min: number, max: number, what: string) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`${what}: от ${min} до ${max}`)
  }
  for (const l of ["bridge", "premium", "luxury"] as Level[]) {
    const r = s.levels[l]
    num(r.spacing, 0.8, 5, `${LEVEL_NAME[l]}: запас между вещами`)
    num(r.max_sizes, 1, 8, `${LEVEL_NAME[l]}: размеров модели`)
    num(r.face_every, 0, 20, `${LEVEL_NAME[l]}: лицом вперёд`)
    num(r.shelf_cost, 0.5, 4, `${LEVEL_NAME[l]}: места на полке`)
  }
  num(s.focus_density, 0.3, 1, "Плотность в фокус-зоне")
  for (const k of ["top", "bottom"] as const) {
    num(s.hangers[k].w, 15, 70, "Ширина плечиков, см")
    num(s.hangers[k].h, 5, 40, "Высота вешалки, см")
    num(s.hangers[k].t, 0.5, 6, "Толщина вешалки, см")
  }
  for (const k of ["outer", "mid", "top", "bottom"] as const) num(s.garment_cm[k], 0.5, 20, "Толщина вещи, см")
  if (!["bridge", "premium", "luxury"].includes(s.default_level)) throw new Error("Неверный уровень по умолчанию")
  for (const [b, r] of Object.entries(s.brands)) {
    if (!["bridge", "premium", "luxury"].includes(r.level)) throw new Error(`Бренд ${b}: неверный уровень`)
    s.brands[b] = { level: r.level, style: r.style ? String(r.style).slice(0, 40) : null, anchor: !!r.anchor }
  }
  s.last_unit = !!s.last_unit
  const lines = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 30)
  for (const k of ["all", "rail", "shelf", "shoes", "table"] as StandardKind[]) s.standards[k] = lines(s.standards[k])
  if (!["offline", "site"].includes(s.score_source)) s.score_source = "offline"
  num(s.area_plan.mix, 0, 1, "План площади: вес продаж")
  s.area_plan.enabled = !!s.area_plan.enabled
  for (const [b, v] of Object.entries(s.area_plan.shares)) {
    if (v === null || v === undefined || (v as unknown) === "") { delete s.area_plan.shares[b]; continue }
    num(Number(v), 0, 100, `Доля бренда ${b}, %`)
    s.area_plan.shares[b] = Number(v)
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.replenish.time)) throw new Error("Довешивание: время в виде 11:00")
  s.replenish.enabled = !!s.replenish.enabled
  if (!Array.isArray(s.looks) || s.looks.length > 100) throw new Error("Образов — не больше 100")
  s.looks = s.looks.map((l) => {
    const name = String(l.name ?? "").trim().slice(0, 80)
    if (!name) throw new Error("У образа нет названия")
    if (!["mannequin", "table", "rail"].includes(l.place)) throw new Error(`Образ «${name}»: неверное место`)
    return { id: String(l.id || Math.random().toString(36).slice(2, 10)).slice(0, 20), name, place: l.place, products: (Array.isArray(l.products) ? l.products : []).map(String).slice(0, 12), active: !!l.active }
  })
  if (!Array.isArray(s.checklists) || s.checklists.length > 30) throw new Error("Чек-листов — не больше 30")
  s.checklists = s.checklists.map((c) => {
    const name = String(c.name ?? "").trim().slice(0, 80)
    if (!name) throw new Error("У чек-листа нет названия")
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(c.time))) throw new Error(`Чек-лист «${name}»: время в виде 10:30`)
    const items = lines(c.items)
    if (!items.length) throw new Error(`Чек-лист «${name}»: нет пунктов`)
    const days = (Array.isArray(c.days) ? c.days : []).map(Number).filter((d) => d >= 0 && d <= 6)
    return { id: String(c.id || Math.random().toString(36).slice(2, 10)).slice(0, 20), name, items, days: [...new Set(days)].sort(), time: String(c.time), enabled: !!c.enabled && days.length > 0 }
  })
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
    // Стойка на подиуме: по 12 см с краёв — стойки конструкции, рабочая часть штанги короче
    case "rack_base": return rail(Math.max(0.2, e.w - 0.24))
    case "rack_pipe": return rail(e.w)
    case "rack_pipe_double": return rail(e.w * 2)
    case "rack_square": {
      // Штанги по периметру: перед и зад — по длине, бока — по ширине; закрытые стороны не считаются
      const closed = new Set(e.closed ?? [])
      const len = (["front", "back"] as Side[]).filter((s) => !closed.has(s)).length * Math.max(0, e.w - 0.1)
        + (["left", "right"] as Side[]).filter((s) => !closed.has(s)).length * Math.max(0, e.d - 0.1)
      return rail(len)
    }
    case "round_rack": return rail(Math.PI * e.w * 0.8)
    // Полки через 30 см; по 4 пары на 144 см полки
    case "shoe_rack": return { ...none, shelf: Math.max(1, Math.floor((e.h - 0.05) / 0.3)) * perLen(e.w, 0.36), shelfCats: ["obuv"] }
    case "cabinet": return { ...none, shelf: 4 * perLen(e.w, 0.35), shelfCats: SHELF_CATS }
    case "wall_shelves": return { ...none, shelf: 5 * perLen(e.w, 0.35), shelfCats: SHELF_CATS }
    case "grid_panel": return { ...none, shelf: Math.max(2, Math.floor((e.w * e.h) / 0.25)), shelfCats: ["sumki-i-ryukzaki"] }
    case "wall_shelf":
    case "wall_shelf_s": return { ...none, shelf: e.w >= 0.55 ? 2 : 1, shelfCats: WALL_SHELF_CATS }
    case "table_cube":
    case "table_white": return { ...none, shelf: Math.min(8, Math.max(1, Math.floor((e.w * e.d) / 0.2))), shelfCats: TABLE_CATS }
    case "podium": return { ...none, shelf: 1, shelfCats: ["obuv", "sumki-i-ryukzaki", "golovnye-ubory"] }
    // Витрина ресепшена под стеклом — мелкие аксессуары в два ряда
    case "showcase": return { ...none, shelf: 2 * perLen(e.w - 0.2, 0.2), shelfCats: ["aksessuary", "nizhnee-bele-i-noski"] }
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
  if (!door && !room.entrance) return power
  const mid = door ? door.offset + door.width / 2 : 0
  const pt = room.entrance ? [room.entrance.x, room.entrance.y]
    : door!.wall === "top" ? [mid, 0] : door!.wall === "bottom" ? [mid, room.length] : door!.wall === "left" ? [0, mid] : [room.width, mid]
  const dist = Math.hypot(e.x - pt[0], e.y - pt[1])
  const diag = Math.hypot(room.width, room.length) || 1
  return power + 2 * (1 - Math.min(1, dist / diag))
}

export const levelOf = (p: MProduct, s: MerchSettings): Level => s.brands[p.brand ?? ""]?.level ?? s.default_level

const BOTTOMS = new Set(["bryuki", "dzhinsy", "shorty"])
/** Вешалка для вещи: низ — на брючной, остальное — на вешалке для верха */
export const hangerOf = (cat: string | null, s: MerchSettings = DEFAULT_SETTINGS) => (BOTTOMS.has(cat ?? "") ? s.hangers.bottom : s.hangers.top)

/** Сколько см штанги занимает одна вешалка с вещью: толщина вещи (не меньше вешалки) × запас уровня бренда */
export function stepCm(p: MProduct, s: MerchSettings = DEFAULT_SETTINGS): number {
  const g = s.garment_cm
  const t = p.cat === "kurtki" ? g.outer : p.cat === "svitery-i-kardigany" || p.cat === "hudi-i-svitshoty" ? g.mid : BOTTOMS.has(p.cat ?? "") ? g.bottom : g.top
  return Math.max(t, hangerOf(p.cat, s).t) * s.levels[levelOf(p, s)].spacing
}

/** Метры штанги под модель: вешалки размеров; «лицом вперёд» — первая вешалка занимает ширину плечиков */
export function railMetersOf(p: MProduct, n: number, face: boolean, s: MerchSettings = DEFAULT_SETTINGS): number {
  const step = stepCm(p, s)
  return (n * step + (face ? Math.max(0, hangerOf(p.cat, s).w - step) : 0)) / 100
}

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

const RAIL_TYPES = new Set(["wall_system", "rack_base", "rack_pipe", "rack_pipe_double", "round_rack", "rack_square"])

/**
 * Стороны квадратной стойки, упирающиеся в колонну, перегородку или стену (ближе 70 см) — с них не подойти,
 * вещи там не вешаются. Плюс стороны, закрытые вручную.
 */
export function closedSides(e: EquipLike, items: EquipLike[], room?: { width: number; length: number }): Side[] {
  const out = new Set<Side>(e.closed ?? [])
  if (e.type !== "rack_square") return [...out]
  const a = ((e.rot ?? 0) * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  const mids: [Side, number, number][] = [["front", 0, e.d / 2], ["back", 0, -e.d / 2], ["left", -e.w / 2, 0], ["right", e.w / 2, 0]]
  for (const [side, lx, ly] of mids) {
    const px = e.x + lx * c - ly * s, py = e.y + lx * s + ly * c
    if (room && (px < 0.7 || py < 0.7 || room.width - px < 0.7 || room.length - py < 0.7)) out.add(side)
    for (const o of items) {
      if (o.id === e.id || (o.type !== "column" && o.type !== "partition")) continue
      const half = o.type === "column" ? Math.max(o.w, o.d) / 2 : 0.05
      const dx = Math.abs(px - o.x), dy = Math.abs(py - o.y)
      // Перегородка — длинная: близость по перпендикуляру (грубо, по осям)
      const near = o.type === "column" ? Math.hypot(dx, dy) < half + 0.7 : Math.min(dx, dy) < 0.7 && Math.max(dx, dy) < o.w / 2 + 0.2
      if (near) out.add(side)
    }
  }
  return [...out]
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** Вход элементом «Вход» на плане важнее двери в стене */
export function withEntrance(room: RoomLike, items: EquipLike[]): RoomLike {
  const e = items.find((i) => i.type === "entrance")
  return e ? { ...room, entrance: { x: e.x, y: e.y } } : room
}

export function autofill(items: EquipLike[], zones: ZoneLike[], rawRoom: RoomLike, products: MProduct[], current: Assign, opts: AutofillOpts = {}): Assign {
  const room = withEntrance(rawRoom, items)
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
    .map((e) => (e.type === "rack_square" ? { ...e, closed: closedSides(e, items, room) } : e))
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
    // Корнер бренда: зона задаёт бренды, если у самого оборудования они не заданы
    if (!e.brands?.length && zone?.brands?.length && !zone.brands.includes(p.brand ?? "")) return false
    // Только мужское / только женское; унисекс подходит к обоим
    if (e.gender && p.gender && p.gender !== "unisex" && p.gender !== e.gender) return false
    // Outlet — только в зоне распродажи, и в зоне распродажи — только Outlet
    if (zone?.role === "sale") return !!p.outlet
    if (p.outlet) return false
    if (zone?.role === "cash") return CASH_CATS.includes(p.cat)
    return true
  }

  /** Заполнить оборудование брендовыми блоками, капсулами внутри бренда */
  const fill = (job: Job, cats: string[], place: Place, pre: Slot[] = []): Slot[] => {
    const { e, cap, zone } = job
    const density = zone?.role === "focus" ? S.focus_density : 1
    // Штанга считается в метрах (плотность — по уровню бренда), полки — в «местах»
    const cost = (p: MProduct, face = false) => place === "rail"
      ? railMetersOf(p, facingsOf(p, place, S), face, S)
      : S.levels[levelOf(p, S)].shelf_cost
    let left = (place === "rail" ? cap.railM * density : cap.shelf) - pre.reduce((a, s) => a + (byId.get(s.p) ? cost(byId.get(s.p)!) : 0), 0)
    const total = place === "rail" ? cap.railM * density : cap.shelf
    const near = place === "shelf" ? neighbourBrands(e, e.type.startsWith("table") ? 2.2 : 1.5) : neighbourBrands(e, 2.5)
    // Образ мерчендайзера уже висит — продолжаем его бренд
    for (const s of pre) { const b = brandOf(s.p) ?? "—"; near.set(b, (near.get(b) ?? 0) + 5); equipBrands.set(e.id, new Set([...(equipBrands.get(e.id) ?? []), b])) }
    const out: Slot[] = [...pre]
    let blocks = 0
    // Новинки — в фокус: двойной вес. Роли по продажам магазина:
    // «второй шанс» — в сильные места; хит без размеров — не в фокус, ближе к примерочным; не сезон — в дальнюю зону
    const strong = (zone?.power ?? 2) >= 4
    const weight = (p: MProduct) => {
      let k = zone?.role === "focus" && p.fresh ? 2 : 1
      if (p.role === "second_chance" && strong) k *= 1.6
      if (p.role === "hit_broken") k *= zone?.role === "fitting" ? 1.3 : strong ? 0.5 : 1
      if (p.role === "offseason") k *= zone?.role === "back" ? 1 : 0.2
      return Math.max(0.01, p.score) * k
    }
    while (left > 1e-6 && blocks < 3) {
      const pool = avail.filter((p) => fits(p, e, cats, zone))
      if (!pool.length) break
      const groups = new Map<string, MProduct[]>()
      // «Микс»: одна общая группа — лучшие вещи разных брендов
      if (e.mix) groups.set("микс", pool)
      else for (const p of pool) groups.set(p.brand ?? "—", [...(groups.get(p.brand ?? "—") ?? []), p])
      let best: { brand: string; list: MProduct[]; value: number } | null = null
      for (const [brand, list] of groups) {
        // Ценность бренда для места: средний балл того, что поместится, × насколько он заполнит место
        // (сумма баллов любила бы мелкие вещи: футболок влезает больше, чем курток)
        let space = left, sum = 0, cnt = 0
        for (const p of list) {
          const c = cost(p)
          if (c > space + 1e-6) continue
          space -= c
          sum += weight(p)
          cnt++
          if (space <= 1e-6) break
        }
        let value = cnt ? (sum / cnt) * ((left - space) / (left || 1)) : 0
        const uses = brandUses.get(brand) ?? 0
        const anchor = !!brandRule(brand)?.anchor
        value *= anchor && uses < 2 ? 1.2 : Math.pow(0.75, uses)
        // План площади: бренд уже занял свою долю стоек — почти не берём
        if (place === "rail" && plan && uses >= (plan.get(brand) ?? 1)) value *= 0.05
        if (pre.some((s) => brandOf(s.p) === brand)) value *= 2
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
      let caps = place === "rail" ? capsules(chosen) : [chosen]
      if (place === "rail") {
        // Вещи «лицом вперёд» занимают ширину плечиков — если не влезло, убираем последние вещи капсул
        const isFace = (i: number, k: number) => i === 0 || (rule.face_every > 0 && k % rule.face_every === 0)
        const extra = () => { let k = 0, m = 0; for (const g of caps) g.forEach((p, i) => { k++; if (isFace(i, k)) m += railMetersOf(p, 1, true, S) - railMetersOf(p, 1, false, S) }); return m }
        while (extra() > left + 1e-6) {
          const g = [...caps].sort((a, b) => b.length - a.length)[0]
          if (!g || g.length <= 1) { const last = caps.pop(); last?.forEach((p) => { placed.delete(p.id); left += cost(p) }); if (!caps.length) break; continue }
          const p = g.pop()!
          placed.delete(p.id)
          left += cost(p)
        }
        left -= extra()
        caps = caps.filter((g) => g.length)
      }
      let k = 0
      for (const group of caps) {
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
  const plan = S.area_plan?.enabled ? areaTargets(products, jobs.filter((j) => RAIL_TYPES.has(j.e.type) && j.zone?.role !== "entry" && j.zone?.role !== "sale").length, S) : null
  // Образы мерчендайзера — первыми: манекен + вещи образа на ближайшей стойке, образ на столе, капсула в начале стойки
  const seeded = new Map<string, Slot[]>()
  const busy = new Set<string>()
  const lookItems = (l: Look) => l.products.map((id) => byId.get(id)).filter((p): p is MProduct => !!p && p.sizes.length > 0 && !placed.has(p.id) && !p.outlet)
  const seed = (railJob: Job, ps: MProduct[]) => {
    const list = ps.filter((p) => p.cat && railJob.cap.railCats.includes(p.cat))
    if (!list.length) return
    seeded.set(railJob.e.id, [...(seeded.get(railJob.e.id) ?? []), ...list.map((p, i) => ({ p: p.id, n: facingsOf(p, "rail", S), place: "rail" as Place, ...(i === 0 ? { face: true } : {}) }))])
    list.forEach((p) => placed.add(p.id))
  }
  const freeRail = (near?: EquipLike) => jobs
    .filter((j) => RAIL_TYPES.has(j.e.type) && j.zone?.role !== "entry" && j.zone?.role !== "sale" && (!near || dist(j.e, near) <= 2.5))
    .sort((a, b) => (near ? dist(a.e, near) - dist(b.e, near) : b.s - a.s))[0]
  for (const l of (S.looks ?? []).filter((x) => x.active)) {
    const ps = lookItems(l)
    if (!ps.length) continue
    if (l.place === "mannequin") {
      const m = jobs.filter((j) => j.e.type === "mannequin" && !busy.has(j.e.id)).sort(byStrength)[0]
      if (!m) continue
      busy.add(m.e.id)
      result[m.e.id] = ps.slice(0, 4).map((p) => ({ p: p.id, n: 1, place: "rail" as Place }))
      const r = freeRail(m.e)
      if (r) seed(r, ps)
    } else if (l.place === "table") {
      const t = jobs.filter((j) => (j.e.type.startsWith("table") || j.e.type === "podium") && !busy.has(j.e.id) && j.zone?.role !== "sale").sort(byStrength)[0]
      if (!t) continue
      busy.add(t.e.id)
      const list = ps.filter((p) => p.cat && t.cap.shelfCats.includes(p.cat)).slice(0, t.cap.shelf)
      result[t.e.id] = list.map((p) => ({ p: p.id, n: 1, place: "shelf" as Place }))
      list.forEach((p) => placed.add(p.id))
    } else {
      const r = jobs.filter((j) => RAIL_TYPES.has(j.e.type) && !seeded.has(j.e.id) && j.zone?.role !== "entry" && j.zone?.role !== "sale").sort(byStrength)[0]
      if (r) seed(r, ps)
    }
  }
  const rails = jobs.filter((j) => RAIL_TYPES.has(j.e.type)).sort(byStrength)
  const shelves = jobs.filter((j) => !RAIL_TYPES.has(j.e.type) && j.e.type !== "mannequin").sort(byStrength)
  const mannequins = jobs.filter((j) => j.e.type === "mannequin").sort(byStrength)

  // 1. Штанги. В зоне входа (адаптация) стойки не заполняются
  for (const job of rails) {
    if (job.zone?.role === "entry") continue
    const slots = fill(job, job.cap.railCats, "rail", seeded.get(job.e.id) ?? [])
    if (job.cap.shelf > 0) slots.push(...fill(job, job.cap.shelfCats, "shelf"))
    if (slots.length) result[job.e.id] = slots
  }
  // 2. Полки, столы, стеллажи — с оглядкой на соседние стойки
  for (const job of shelves) {
    if (job.e.id in result) continue
    const slots = fill(job, job.cap.shelfCats, "shelf")
    if (slots.length) result[job.e.id] = slots
  }
  // 3. Манекены: образ одного бренда из вещей соседних стоек (в радиусе 2,5 м) — покупатель найдёт их рядом
  for (const { e } of mannequins) {
    if (e.id in result) continue
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

/**
 * План площади (ТЗ, п. 3.5): сколько стоек положено бренду. Доля = mix × доля в продажах магазина за 60 дней
 * + (1 − mix) × доля в остатке одежды на вешалках; ручная доля (%) важнее. Якорному бренду — не меньше 2 стоек.
 */
export function areaShares(products: MProduct[], S: MerchSettings) {
  const hang = products.filter((p) => p.cat && HANG_CATS.includes(p.cat) && !p.outlet)
  const by = new Map<string, { sales: number; stock: number; models: number }>()
  for (const p of hang) {
    const b = p.brand ?? "—"
    const r = by.get(b) ?? { sales: 0, stock: 0, models: 0 }
    r.sales += p.q60 ?? 0
    r.stock += Math.max(0, p.units)
    r.models++
    by.set(b, r)
  }
  const ts = [...by.values()].reduce((a, r) => a + r.sales, 0)
  const tk = [...by.values()].reduce((a, r) => a + r.stock, 0)
  const mix = ts > 0 ? S.area_plan.mix : 0
  return [...by.entries()].map(([brand, r]) => {
    const auto = mix * (ts ? r.sales / ts : 0) + (1 - mix) * (tk ? r.stock / tk : 0)
    const manual = S.area_plan.shares[brand]
    return { brand, sales: ts ? r.sales / ts : 0, stock: tk ? r.stock / tk : 0, models: r.models, share: manual !== undefined ? manual / 100 : auto, manual: manual !== undefined }
  }).sort((a, b) => b.share - a.share)
}

export function areaTargets(products: MProduct[], rails: number, S: MerchSettings): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of areaShares(products, S)) {
    let n = Math.round(r.share * rails)
    if (S.brands[r.brand]?.anchor) n = Math.max(2, n)
    m.set(r.brand, Math.max(r.models >= 5 ? 1 : 0, n))
  }
  return m
}

/** Заполненность: занято вешалок на штанге / мест на полках */
export function usedOf(slots: Slot[] | undefined) {
  const s = slots ?? []
  return { rail: s.filter((x) => x.place === "rail").reduce((a, x) => a + x.n, 0), shelf: s.filter((x) => x.place === "shelf").reduce((a, x) => a + x.n, 0) }
}

/** Сколько метров штанги занято товарами (с учётом вешалок, толщины вещей и «лицом вперёд») */
export function railUsedM(slots: Slot[] | undefined, byId: Map<string, MProduct>, s: MerchSettings = DEFAULT_SETTINGS) {
  return (slots ?? []).filter((x) => x.place === "rail").reduce((a, x) => { const p = byId.get(x.p); return a + (p ? railMetersOf(p, x.n, !!x.face, s) : x.n * 0.03) }, 0)
}
