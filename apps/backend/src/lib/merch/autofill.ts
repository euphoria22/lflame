/**
 * Раскладка товаров по оборудованию зала. Чистые функции без базы — работают и в админке (кнопка
 * «Разложить товары»), и в тестах.
 *
 * Как раскладывает (правила мерчендайзинга):
 * 1. Сильные места первыми: сила = звёзды зоны + близость ко входу. Туда — товары с самым высоким баллом
 *    умной сортировки (балл уже учитывает сезон, новизну, остаток, продажи).
 * 2. Одна стойка — один бренд («брендовый блок»). Если бренд не заполнил стойку больше чем на 70 %,
 *    рядом добавляется второй бренд. Каждая следующая стойка того же бренда получает штраф — бренды чередуются.
 * 3. На стойке: по категориям (верхняя одежда → свитеры/худи → рубашки → футболки → низ), внутри — от светлого к тёмному.
 * 4. Вешалок на модель — по числу размеров в наличии (до 3): размерный ряд висит рядом.
 * 5. Обувь — на стеллажи из труб, сумки и кепки — на шкафы, сетку и полки, на столы — сложенное и аксессуары,
 *    манекен — готовый образ (верх + низ + верхняя одежда) одного бренда.
 * 6. Закреплённое оборудование не трогается; у оборудования можно ограничить категории и бренды.
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
}

export type Place = "rail" | "shelf"
/** Товар на оборудовании: n — вешалок (на штанге) или мест (на полке/столе) */
export type Slot = { p: string; n: number; place: Place }
export type Assign = Record<string, Slot[]>

export type EquipLike = { id: string; type: string; x: number; y: number; w: number; d: number; h: number; lock?: boolean; cats?: string[]; brands?: string[] }
export type ZoneLike = { x: number; y: number; w: number; d: number; power: number }
export type RoomLike = { width: number; length: number; openings: { kind: string; wall: string; offset: number; width: number }[] }

export const HANG_CATS = ["kurtki", "svitery-i-kardigany", "hudi-i-svitshoty", "rubashki-i-polo", "futbolki-i-longslivy", "bryuki", "dzhinsy", "shorty"]
const SHELF_CATS = ["sumki-i-ryukzaki", "golovnye-ubory", "aksessuary"]
const TABLE_CATS = ["futbolki-i-longslivy", "svitery-i-kardigany", "hudi-i-svitshoty", "golovnye-ubory", "sumki-i-ryukzaki", "aksessuary", "nizhnee-bele-i-noski"]
const WALL_SHELF_CATS = ["golovnye-ubory", "futbolki-i-longslivy", "aksessuary", "svitery-i-kardigany"]

export const CAT_NAME: Record<string, string> = {
  kurtki: "Куртки", "svitery-i-kardigany": "Свитеры", "hudi-i-svitshoty": "Худи и свитшоты", "rubashki-i-polo": "Рубашки и поло",
  "futbolki-i-longslivy": "Футболки и лонгсливы", bryuki: "Брюки", dzhinsy: "Джинсы", shorty: "Шорты", obuv: "Обувь",
  "sumki-i-ryukzaki": "Сумки и рюкзаки", "golovnye-ubory": "Головные уборы", aksessuary: "Аксессуары", "nizhnee-bele-i-noski": "Бельё и носки",
}

/** Что и сколько помещается на оборудование: места на штанге (вешалки) и на полках/столе */
export type Capacity = { rail: number; shelf: number; railCats: string[]; shelfCats: string[] }

const perLen = (len: number, step: number) => Math.max(1, Math.floor(len / step))

export function capacityOf(e: EquipLike): Capacity {
  const none: Capacity = { rail: 0, shelf: 0, railCats: [], shelfCats: [] }
  switch (e.type) {
    case "wall_system": return { rail: Math.round(e.w * 15), shelf: perLen(e.w, 0.45), railCats: HANG_CATS, shelfCats: ["sumki-i-ryukzaki", "golovnye-ubory"] }
    case "rack_base":
    case "rack_pipe": return { ...none, rail: Math.round(e.w * 15), railCats: HANG_CATS }
    case "rack_pipe_double": return { ...none, rail: Math.round(e.w * 15) * 2, railCats: HANG_CATS }
    case "round_rack": return { ...none, rail: Math.round(Math.PI * e.w * 12), railCats: HANG_CATS }
    case "shoe_rack": return { ...none, shelf: Math.max(2, Math.round(e.h / 0.4)) * perLen(e.w, 0.45), shelfCats: ["obuv"] }
    case "cabinet": return { ...none, shelf: 3 * perLen(e.w, 0.35), shelfCats: SHELF_CATS }
    case "wall_shelves": return { ...none, shelf: 5 * perLen(e.w, 0.35), shelfCats: SHELF_CATS }
    case "grid_panel": return { ...none, shelf: Math.max(2, Math.floor((e.w * e.h) / 0.25)), shelfCats: ["sumki-i-ryukzaki"] }
    case "wall_shelf":
    case "wall_shelf_s": return { ...none, shelf: e.w >= 0.55 ? 2 : 1, shelfCats: WALL_SHELF_CATS }
    case "table_cube":
    case "table_white": return { ...none, shelf: Math.min(8, Math.max(1, Math.floor((e.w * e.d) / 0.2))), shelfCats: TABLE_CATS }
    case "podium": return { ...none, shelf: 1, shelfCats: ["obuv", "sumki-i-ryukzaki", "golovnye-ubory"] }
    case "mannequin": return { ...none, rail: 3, railCats: ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany", "futbolki-i-longslivy", "rubashki-i-polo", "bryuki", "dzhinsy", "shorty"] }
    default: return none
  }
}

/** Порядок категорий на штанге */
const CAT_ORDER = ["kurtki", "svitery-i-kardigany", "hudi-i-svitshoty", "rubashki-i-polo", "futbolki-i-longslivy", "bryuki", "dzhinsy", "shorty"]

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

/** Сила места: звёзды зоны (по умолчанию 2) + до 2 за близость ко входу */
export function strengthOf(e: EquipLike, zones: ZoneLike[], room: RoomLike): number {
  const inZone = zones.filter((z) => e.x >= z.x && e.x <= z.x + z.w && e.y >= z.y && e.y <= z.y + z.d)
  const power = inZone.length ? Math.max(...inZone.map((z) => z.power)) : 2
  const door = room.openings.find((o) => o.kind === "door")
  if (!door) return power
  const mid = door.offset + door.width / 2
  const pt = door.wall === "top" ? [mid, 0] : door.wall === "bottom" ? [mid, room.length] : door.wall === "left" ? [0, mid] : [room.width, mid]
  const dist = Math.hypot(e.x - pt[0], e.y - pt[1])
  const diag = Math.hypot(room.width, room.length) || 1
  return power + 2 * (1 - Math.min(1, dist / diag))
}

const facingsOf = (p: MProduct, place: Place) => (place === "rail" ? Math.min(3, Math.max(1, p.sizes.length)) : 1)

/** Порядок на штанге/полке: по категориям, внутри — от светлого к тёмному */
export function orderSlots(slots: Slot[], byId: Map<string, MProduct>): Slot[] {
  const catIdx = (c: string | null) => { const i = CAT_ORDER.indexOf(c ?? ""); return i < 0 ? 99 : i }
  return [...slots].sort((a, b) => {
    const pa = byId.get(a.p), pb = byId.get(b.p)
    if (!pa || !pb) return 0
    if (a.place !== b.place) return a.place === "rail" ? -1 : 1
    if ((pa.brand ?? "") !== (pb.brand ?? "")) return 0
    return catIdx(pa.cat) - catIdx(pb.cat) || (COLOR_LIGHT[pb.color ?? ""] ?? 0.5) - (COLOR_LIGHT[pa.color ?? ""] ?? 0.5)
  })
}

export type AutofillOpts = { onlyEmpty?: boolean }

export function autofill(items: EquipLike[], zones: ZoneLike[], room: RoomLike, products: MProduct[], current: Assign, opts: AutofillOpts = {}): Assign {
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
  const avail = products.filter((p) => p.sizes.length > 0 && !placed.has(p.id)).sort((a, b) => b.score - a.score)
  const todo = items
    .filter((e) => !(e.id in result))
    .map((e) => ({ e, cap: capacityOf(e), s: strengthOf(e, zones, room) }))
    .filter((x) => x.cap.rail > 0 || x.cap.shelf > 0)
    .sort((a, b) => b.s - a.s)
  const brandUses = new Map<string, number>()

  const fits = (p: MProduct, e: EquipLike, cats: string[]) =>
    !placed.has(p.id) && !!p.cat && cats.includes(p.cat) && (!e.cats?.length || e.cats.includes(p.cat)) && (!e.brands?.length || e.brands.includes(p.brand ?? ""))

  /** Заполнить capacity мест брендовыми блоками */
  const fillBlocks = (e: EquipLike, cats: string[], capacity: number, place: Place): Slot[] => {
    const out: Slot[] = []
    let left = capacity
    let blocks = 0
    while (left > 0 && blocks < 3) {
      const pool = avail.filter((p) => fits(p, e, cats))
      if (!pool.length) break
      // Ценность бренда: сумма баллов того, что поместится, со штрафом за уже занятые им места
      const groups = new Map<string, MProduct[]>()
      for (const p of pool) groups.set(p.brand ?? "—", [...(groups.get(p.brand ?? "—") ?? []), p])
      let best: { brand: string; list: MProduct[]; value: number } | null = null
      for (const [brand, list] of groups) {
        let space = left, value = 0
        for (const p of list) {
          const n = facingsOf(p, place)
          if (n > space) continue
          space -= n
          value += Math.max(0.01, p.score)
          if (space <= 0) break
        }
        value *= Math.pow(0.75, brandUses.get(brand) ?? 0)
        if (!best || value > best.value) best = { brand, list, value }
      }
      if (!best) break
      for (const p of best.list) {
        const n = facingsOf(p, place)
        if (n > left) continue
        out.push({ p: p.id, n, place })
        placed.add(p.id)
        left -= n
        if (left <= 0) break
      }
      brandUses.set(best.brand, (brandUses.get(best.brand) ?? 0) + 1)
      blocks++
      // Бренд занял больше 70 % — второй блок не нужен
      if (left <= capacity * 0.3) break
    }
    return out
  }

  for (const { e, cap } of todo) {
    let slots: Slot[] = []
    if (e.type === "mannequin") {
      // Образ: верхняя одежда/худи + верх + низ одного бренда
      const tops = avail.filter((p) => fits(p, e, ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany"]))
      for (const outer of tops) {
        const brand = outer.brand
        const tee = avail.find((p) => p.brand === brand && fits(p, e, ["futbolki-i-longslivy", "rubashki-i-polo"]))
        const bottom = avail.find((p) => p.brand === brand && fits(p, e, ["bryuki", "dzhinsy", "shorty"]))
        if (!bottom) continue
        slots = [outer, ...(tee ? [tee] : []), bottom].map((p) => ({ p: p.id, n: 1, place: "rail" as Place }))
        slots.forEach((s) => placed.add(s.p))
        break
      }
    } else {
      if (cap.rail > 0) slots.push(...fillBlocks(e, cap.railCats, cap.rail, "rail"))
      if (cap.shelf > 0) slots.push(...fillBlocks(e, cap.shelfCats, cap.shelf, "shelf"))
    }
    result[e.id] = orderSlots(slots, byId)
  }
  for (const e of items) if (!(e.id in result)) result[e.id] = current[e.id] ?? []
  // Пустые списки не храним
  for (const k of Object.keys(result)) if (!result[k].length) delete result[k]
  return result
}

/** Заполненность: занято мест на штанге/полках */
export function usedOf(slots: Slot[] | undefined) {
  const s = slots ?? []
  return { rail: s.filter((x) => x.place === "rail").reduce((a, x) => a + x.n, 0), shelf: s.filter((x) => x.place === "shelf").reduce((a, x) => a + x.n, 0) }
}
