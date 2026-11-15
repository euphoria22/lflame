import type { Assign } from "../../../lib/merch/autofill"

/**
 * Мерчендайзинг: типы данных расстановки и каталог оборудования (по фото магазина).
 * Координаты в метрах: x — вдоль плана слева направо, y — сверху вниз; поворот — в градусах по часовой.
 * В 3D: x → x, y → z, высота — вверх.
 */

export type WallSide = "top" | "right" | "bottom" | "left"
export type WallFinish = "brick" | "white" | "concrete" | "glass"

export type Opening = { id: string; kind: "door" | "window" | "showcase"; wall: WallSide; offset: number; width: number }

export type Room = {
  width: number
  length: number
  /** Высота в коньке (мансардная крыша: скаты от длинных стен к середине) */
  height: number
  /** Высота длинных стен до начала ската; если равна height — потолок плоский */
  eave?: number
  walls: Record<WallSide, WallFinish>
  openings: Opening[]
}

export type Item = {
  id: string
  type: string
  x: number
  y: number
  rot: number
  w: number
  d: number
  h: number
  /** Высота крепления над полом (полки, сетка, трек) */
  elev?: number
  label?: string
  note?: string
  /** Закреплено: автораскладка не меняет товары на нём */
  lock?: boolean
  /** Ограничения для автораскладки: только эти категории / бренды */
  cats?: string[]
  brands?: string[]
}

export type Zone = { id: string; name: string; x: number; y: number; w: number; d: number; color: string; /** 1–5: насколько сильное место */ power: number }

export type Background = { src: string; x: number; y: number; w: number; opacity: number }

/** Товары на оборудовании: id единицы оборудования → список по порядку */
export type LayoutData = { room: Room; items: Item[]; zones: Zone[]; background?: Background | null; assign?: Assign }

export type Group = "hang" | "shelf" | "table" | "decor" | "service" | "build"

export type EquipType = {
  type: string
  name: string
  group: Group
  w: number
  d: number
  h: number
  elev?: number
  /** Вешалок на метр штанги (для стоек), полок, мест на столе */
  hangPerM?: number
  rails?: number
  shelves?: number
  /** Что обычно размещают — подсказка */
  hint: string
  /** Крепится к стене — прилипает спиной к стене */
  wall?: boolean
  round?: boolean
}

export const GROUP_NAME: Record<Group, string> = {
  hang: "Вешала",
  shelf: "Полки и стеллажи",
  table: "Столы и подиумы",
  decor: "Манекены и декор",
  service: "Касса, примерочные",
  build: "Помещение",
}

export const GROUP_COLOR: Record<Group, string> = {
  hang: "#6b8afd",
  shelf: "#f59e0b",
  table: "#10b981",
  decor: "#ec4899",
  service: "#8b5cf6",
  build: "#78716c",
}

export const CATALOG: EquipType[] = [
  { type: "wall_system", name: "Пристенная система со штангой", group: "hang", w: 3.6, d: 0.4, h: 2.6, hangPerM: 15, rails: 1, shelves: 1, wall: true, hint: "Стойки до потолка, штанга и полка сверху — одежда на вешалках, сумки и кепки на полке" },
  { type: "wall_shelves", name: "Пристенная система с полками", group: "shelf", w: 1.0, d: 0.35, h: 2.4, shelves: 5, wall: true, hint: "Наклонные полки — сумки, кепки, аксессуары" },
  { type: "rack_base", name: "Стойка на плите", group: "hang", w: 1.5, d: 0.6, h: 1.65, hangPerM: 15, rails: 1, hint: "Хромированная стойка на стальном основании — одна штанга" },
  { type: "rack_pipe", name: "Стойка из труб", group: "hang", w: 1.5, d: 0.6, h: 1.7, hangPerM: 15, rails: 1, hint: "Стойка-конструктор из труб на колёсах" },
  { type: "rack_pipe_double", name: "Стойка из труб двойная", group: "hang", w: 1.5, d: 1.1, h: 1.7, hangPerM: 15, rails: 2, hint: "Две параллельные штанги — развеска с двух сторон" },
  { type: "round_rack", name: "Круглая стойка", group: "hang", w: 0.9, d: 0.9, h: 1.5, hangPerM: 12, rails: 1, round: true, hint: "Кольцо-вешало по кругу" },
  { type: "shoe_rack", name: "Стеллаж из труб", group: "shelf", w: 1.4, d: 0.45, h: 2.2, shelves: 5, hint: "Обувь, сумки — по 2–3 пары на полку" },
  { type: "cabinet", name: "Шкаф-стеллаж металлический", group: "shelf", w: 1.0, d: 0.4, h: 1.6, shelves: 4, hint: "Закрытые бока — сумки, рюкзаки, ремни" },
  { type: "wall_shelf", name: "Полка настенная 60 см", group: "shelf", w: 0.6, d: 0.3, h: 0.15, elev: 2.0, shelves: 1, wall: true, hint: "Полка на белой стене: стопки футболок, кепки. Крепление к стене — 15 см" },
  { type: "wall_shelf_s", name: "Полка настенная 40 см", group: "shelf", w: 0.4, d: 0.3, h: 0.15, elev: 2.0, shelves: 1, wall: true, hint: "Полка на белой стене: кепки, 1–2 стопки. Крепление к стене — 15 см" },
  { type: "grid_panel", name: "Сетка настенная", group: "shelf", w: 1.2, d: 0.05, h: 1.2, elev: 0.9, wall: true, hint: "Сумки на крючках" },
  { type: "table_cube", name: "Стол-куб металлический", group: "table", w: 1.6, d: 1.0, h: 0.5, hint: "Выкладка образа: стопки, кепки, сумки" },
  { type: "podium", name: "Подиум", group: "table", w: 1.0, d: 1.0, h: 0.3, hint: "Манекен или акцентная выкладка" },
  { type: "table_white", name: "Стол белый", group: "table", w: 0.95, d: 0.7, h: 0.75, hint: "Выкладка стопками" },
  { type: "pouf_round", name: "Пуф круглый", group: "decor", w: 1.0, d: 1.0, h: 0.45, round: true, hint: "Для примерки обуви" },
  { type: "pouf", name: "Пуф", group: "decor", w: 0.9, d: 0.9, h: 0.45, hint: "Для примерки обуви" },
  { type: "mannequin", name: "Манекен", group: "decor", w: 0.5, d: 0.35, h: 1.85, hint: "Готовый образ" },
  { type: "mirror", name: "Зеркало", group: "decor", w: 0.8, d: 0.06, h: 2.0, wall: true, hint: "" },
  { type: "fitting", name: "Примерочная", group: "service", w: 1.2, d: 1.2, h: 2.4, hint: "Шторы чёрные" },
  { type: "cash", name: "Касса", group: "service", w: 1.6, d: 0.6, h: 1.05, hint: "" },
  { type: "column", name: "Колонна", group: "build", w: 0.5, d: 0.5, h: 4.5, hint: "" },
  { type: "partition", name: "Перегородка", group: "build", w: 3.0, d: 0.1, h: 3.0, hint: "Матовое стекло — отделяет склад" },
  { type: "track", name: "Трек освещения", group: "build", w: 8.0, d: 0.05, h: 0.05, elev: 4.2, hint: "Чёрный трек со споты" },
]

export const typeOf = (t: string): EquipType => CATALOG.find((c) => c.type === t) ?? CATALOG[0]

/** Сколько поместится: вешалок на штангах и полок/мест */
export function capacity(it: Item): { hang: number; shelves: number } {
  const t = typeOf(it.type)
  const railLen = t.round ? Math.PI * it.w : it.w
  return { hang: t.hangPerM ? Math.round(railLen * t.hangPerM * (t.rails ?? 1)) : 0, shelves: t.shelves ?? 0 }
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const WALL_NAME: Record<WallSide, string> = { top: "Верхняя", right: "Правая", bottom: "Нижняя", left: "Левая" }
export const FINISH_NAME: Record<WallFinish, string> = { brick: "Кирпич", white: "Белая", concrete: "Бетон", glass: "Матовое стекло" }

const it = (type: string, x: number, y: number, rot = 0, patch: Partial<Item> = {}): Item => {
  const t = typeOf(type)
  return { id: uid(), type, x, y, rot, w: t.w, d: t.d, h: t.h, ...(t.elev !== undefined ? { elev: t.elev } : {}), ...patch }
}

/**
 * Черновик по текущему плану зала (присланная схема). Пропорции — по плану из договора и рендеру: зал ≈ 14,4 × 8,6 м, склад 3,6 м;
 * точные замеры владелец пришлёт позже. Справа за перегородкой — склад. Крыша мансардная.
 */
export function draftLayout(): LayoutData {
  const rail = (x: number, y: number, rot = 0) => it("rack_base", x, y, rot, { w: 1.4, d: 0.45 })
  return {
    room: {
      width: 18,
      length: 8.6,
      height: 4.6,
      eave: 2.9,
      walls: { top: "white", right: "white", bottom: "brick", left: "brick" },
      openings: [{ id: uid(), kind: "door", wall: "bottom", offset: 6.3, width: 1.3 }],
    },
    items: [
      it("fitting", 0.6, 0.65), it("fitting", 0.6, 1.9),
      rail(2.28, 0.53), rail(4.37, 0.53), rail(7.1, 0.53), rail(9.25, 0.53), rail(11.34, 0.53), rail(13.41, 0.53),
      rail(5.89, 1.51, 90), rail(10.33, 1.58, 90), rail(13.99, 1.63, 90), rail(13.99, 3.08, 90),
      rail(3.49, 2.85), rail(8.39, 2.36, 35),
      rail(11.62, 4.2), rail(10.33, 5.31, 90), rail(11.47, 6.38), rail(13.92, 7.25, 90), rail(7.03, 7.71),
      it("table_white", 3.51, 1.65), it("table_white", 12.4, 2.12, 0, { w: 0.7, d: 0.75 }), it("table_white", 12.4, 2.9, 0, { w: 0.7, d: 0.75 }), it("table_white", 7.61, 6.04),
      it("column", 5.6, 4.11, 0, { h: 4.6 }), it("column", 10.26, 4.11, 0, { h: 4.6 }), it("column", 13.99, 4.11, 0, { h: 4.6 }),
      it("pouf", 2.51, 4.15), it("pouf", 2.73, 6.82),
      it("rack_pipe_double", 7.35, 4.2, 0, { w: 1.65, d: 1.3 }), it("rack_pipe_double", 5.16, 5.71, 90, { w: 1.6, d: 1.3 }),
      it("shoe_rack", 0.23, 4.11, 90, { w: 1.75 }), it("mirror", 0.03, 5.59, 90, { w: 0.9 }), it("shoe_rack", 0.23, 7.01, 90, { w: 1.5 }),
      it("shoe_rack", 3.09, 8.37, 180, { w: 2.1, h: 0.9, label: "Обувь у стены" }), it("shoe_rack", 5.45, 8.37, 180, { w: 2.0, h: 0.9, label: "Обувь у стены" }),
      it("cabinet", 6.95, 8.45, 180, { w: 0.5, d: 0.3, h: 0.9 }), it("cabinet", 8.1, 8.45, 180, { w: 0.5, d: 0.3, h: 0.9 }),
      it("cash", 9.04, 8.35, 180, { w: 1.15, d: 0.5 }),
      it("shoe_rack", 11.93, 8.37, 180, { w: 2.6, h: 0.6, label: "Скамья-стеллаж" }),
      it("cabinet", 13.9, 8.42, 180, { w: 0.6, d: 0.35, h: 0.9 }),
      it("partition", 14.4, 4.3, 90, { w: 8.6, h: 2.9 }),
      it("track", 7.2, 2.5, 0, { w: 12.5, elev: 3.6 }), it("track", 7.2, 6.1, 0, { w: 12.5, elev: 3.6 }),
      // Два ряда полок на белой стене над стойками: 60 см сверху, 40 см ниже между стойками
      ...[2.28, 4.37, 7.1, 9.25, 11.34, 13.41].map((x) => it("wall_shelf", x, 0.15, 0, { elev: 2.35 })),
      ...[3.33, 5.73, 8.18, 10.3, 12.38].map((x) => it("wall_shelf_s", x, 0.15, 0, { elev: 1.95 })),
    ],
    zones: [
      { id: uid(), name: "Вход", x: 5.4, y: 6.8, w: 3.4, d: 1.8, color: "#ef4444", power: 5 },
      { id: uid(), name: "Обувь", x: 0, y: 3.3, w: 1.6, d: 5.3, color: "#f59e0b", power: 3 },
      { id: uid(), name: "Центр", x: 3.9, y: 3.3, w: 6.9, d: 3.1, color: "#3b82f6", power: 4 },
      { id: uid(), name: "Белая стена", x: 1.5, y: 0, w: 12.6, d: 1.0, color: "#10b981", power: 4 },
    ],
    background: null,
  }
}
