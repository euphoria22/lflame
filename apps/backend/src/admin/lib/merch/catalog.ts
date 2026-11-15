import type { Assign, ZoneRole } from "../../../lib/merch/autofill"

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
  /** Только мужское или только женское (унисекс подходит к обоим) */
  gender?: "men" | "women"
  /** Квадратная стойка: закрытые вручную стороны */
  closed?: ("front" | "back" | "left" | "right")[]
}

export type Zone = { id: string; name: string; x: number; y: number; w: number; d: number; color: string; /** 1–5: насколько сильное место */ power: number; /** Роль зоны: от неё зависят правила раскладки */ role?: ZoneRole | null }

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
  { type: "rack_base", name: "Стойка на подиуме", group: "hang", w: 1.8, d: 0.4, h: 1.55, hangPerM: 15, rails: 1, hint: "Нержавейка на цельном подиуме 180 × 40 см: штанга на высоте 149 см, рабочая часть 156 см (по 12 см с краёв — стойки), стойки до 155 см" },
  { type: "rack_pipe", name: "Стойка из труб", group: "hang", w: 1.5, d: 0.6, h: 1.7, hangPerM: 15, rails: 1, hint: "Стойка-конструктор из труб на колёсах" },
  { type: "rack_square", name: "Стойка квадратная из труб", group: "hang", w: 1.3, d: 1.5, h: 1.4, hangPerM: 15, rails: 4, hint: "Толстые трубы, вещи со всех четырёх сторон. Сторона у колонны или стены (ближе 70 см) закрывается сама; любую сторону можно закрыть вручную" },
  { type: "rack_pipe_double", name: "Стойка из труб двойная", group: "hang", w: 1.5, d: 1.1, h: 1.7, hangPerM: 15, rails: 2, hint: "Две параллельные штанги — развеска с двух сторон" },
  { type: "round_rack", name: "Круглая стойка", group: "hang", w: 0.9, d: 0.9, h: 1.5, hangPerM: 12, rails: 1, round: true, hint: "Кольцо-вешало по кругу" },
  { type: "shoe_rack", name: "Стеллаж для обуви", group: "shelf", w: 1.5, d: 0.22, h: 1.8, shelves: 6, hint: "150 × 22 × 180 см (полка 144 см между стойками), 6 полок через 30 см — по 4 пары на полку" },
  { type: "cabinet", name: "Шкаф для сумок", group: "shelf", w: 1.175, d: 0.3, h: 1.8, shelves: 4, hint: "117,5 × 30 × 180 см, 4 полки: просветы снизу 55, 40, 40 и 27 см сверху — сумки, рюкзаки, ремни" },
  { type: "wall_shelf", name: "Полка настенная 60 см", group: "shelf", w: 0.6, d: 0.3, h: 0.15, elev: 2.0, shelves: 1, wall: true, hint: "Полка на белой стене: стопки футболок, кепки. Крепление к стене — 15 см" },
  { type: "wall_shelf_s", name: "Полка настенная 40 см", group: "shelf", w: 0.4, d: 0.3, h: 0.15, elev: 2.0, shelves: 1, wall: true, hint: "Полка на белой стене: кепки, 1–2 стопки. Крепление к стене — 15 см" },
  { type: "grid_panel", name: "Сетка настенная", group: "shelf", w: 1.1, d: 0.05, h: 1.1, elev: 0.6, wall: true, hint: "110 × 110 см, сумки на крючках" },
  { type: "table_cube", name: "Стол-куб металлический", group: "table", w: 1.0, d: 1.0, h: 0.5, hint: "Выкладка образа: стопки, кепки, сумки" },
  { type: "podium", name: "Подиум", group: "table", w: 1.0, d: 1.0, h: 0.3, hint: "Манекен или акцентная выкладка" },
  { type: "table_white", name: "Стол белый", group: "table", w: 1.0, d: 1.0, h: 0.5, hint: "Выкладка стопками" },
  { type: "pouf_round", name: "Пуф круглый", group: "decor", w: 1.0, d: 1.0, h: 0.45, round: true, hint: "Для примерки обуви" },
  { type: "pouf", name: "Пуф", group: "decor", w: 0.9, d: 0.9, h: 0.45, hint: "Для примерки обуви" },
  { type: "mannequin", name: "Манекен", group: "decor", w: 0.5, d: 0.35, h: 1.85, hint: "Готовый образ" },
  { type: "mirror", name: "Зеркало", group: "decor", w: 0.8, d: 0.06, h: 2.0, wall: true, hint: "" },
  { type: "fitting", name: "Примерочная", group: "service", w: 1.2, d: 1.2, h: 2.4, hint: "Шторы чёрные" },
  { type: "cash", name: "Ресепшен", group: "service", w: 2.4, d: 0.6, h: 1.2, hint: "Нержавейка: слева низкая часть с витриной под стеклом для мелких аксессуаров, справа стойка 120 см с полкой-козырьком" },
  { type: "column", name: "Колонна", group: "build", w: 0.5, d: 0.5, h: 4.5, hint: "" },
  { type: "block", name: "Не наша площадь", group: "build", w: 3.0, d: 3.0, h: 4.6, hint: "Часть прямоугольника, которая не относится к магазину: в 3D — стены, проходы считаются до неё" },
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
 * Черновик по планам и рендерам владельца (размеры примерные, уточняются замерами).
 * Помещение не прямоугольное: слева вход и ресепшен, дальше коридор с двумя примерочными, затем зал ≈ 14,4 × 8,6 м,
 * справа за перегородкой — склад. Нижняя левая часть — не наша площадь (элемент «Не наша площадь»).
 */
export function draftLayout(): LayoutData {
  /** Левый край зала (конец коридора) — все вещи зала сдвинуты на него */
  const HX = 14.7
  const rail = (x: number, y: number, rot = 0) => it("rack_base", HX + x, y, rot)
  const h = (type: string, x: number, y: number, rot = 0, patch: Partial<Item> = {}) => it(type, HX + x, y, rot, patch)
  return {
    room: {
      width: HX + 14.4 + 3.6,
      length: 8.6,
      height: 4.6,
      eave: 2.9,
      walls: { top: "white", right: "white", bottom: "brick", left: "brick" },
      openings: [{ id: uid(), kind: "door", wall: "left", offset: 2.2, width: 1.4 }],
    },
    items: [
      // Не наша площадь: под коридором и под ресепшеном
      it("block", (5.9 + HX) / 2, (4.1 + 8.6) / 2, 0, { w: HX - 5.9, d: 8.6 - 4.1, h: 4.6 }),
      it("block", 5.9 / 2, (5.6 + 8.6) / 2, 0, { w: 5.9, d: 3.0, h: 4.6 }),
      // Вход и ресепшен слева, вдоль коридора — две примерочные
      it("cash", 3.2, 5.25, 180, { w: 2.4, d: 0.6, label: "Ресепшен" }),
      it("fitting", HX - 3.75, 1.3, 0, { w: 2.4, d: 2.4 }), it("fitting", HX - 1.25, 1.3, 0, { w: 2.4, d: 2.4 }),
      it("track", HX / 2 + 0.5, 3.1, 0, { w: HX - 1, elev: 3.4 }),
      // Зал
      rail(2.28, 0.53), rail(4.37, 0.53), rail(7.1, 0.53), rail(9.25, 0.53), rail(11.34, 0.53), rail(13.41, 0.53),
      rail(5.89, 1.51, 90), rail(10.33, 1.58, 90), rail(13.99, 1.63, 90), rail(13.99, 3.08, 90),
      rail(3.49, 2.85), rail(8.39, 2.36, 35),
      rail(11.62, 4.2), rail(10.33, 5.31, 90), rail(11.47, 6.38), rail(13.92, 7.25, 90), rail(7.03, 7.71),
      h("table_white", 3.51, 1.65), h("table_white", 12.4, 1.95), h("table_white", 12.4, 3.0), h("table_white", 7.61, 6.04),
      h("column", 5.6, 4.11, 0, { h: 4.6 }), h("column", 10.26, 4.11, 0, { h: 4.6 }), h("column", 13.99, 4.11, 0, { h: 4.6 }),
      h("pouf", 2.51, 4.15), h("pouf", 2.73, 6.82),
      // Квадратные стойки из толстых труб у колонн: сторона к колонне закрывается сама
      h("rack_square", 6.5, 4.2), h("rack_square", 5.3, 5.85, 90),
      // Обувь: на левой стене зала два стеллажа, на нижней — стеллаж, зеркало, стеллаж
      h("shoe_rack", 0.11, 5.4, 90), h("shoe_rack", 0.11, 7.3, 90),
      h("shoe_rack", 1.7, 8.49, 180), h("mirror", 2.85, 8.57, 180, { w: 0.6 }), h("shoe_rack", 4.0, 8.49, 180),
      h("cabinet", 6.95, 8.45, 180, { w: 0.5, d: 0.3, h: 0.9 }), h("cabinet", 8.1, 8.45, 180, { w: 0.5, d: 0.3, h: 0.9 }),
      h("podium", 9.04, 8.35, 0, { w: 1.15, d: 0.5, h: 0.9, label: "Тумба" }),
      h("shoe_rack", 11.93, 8.37, 180, { w: 2.6, h: 0.6, label: "Скамья-стеллаж" }),
      h("cabinet", 13.9, 8.42, 180, { w: 0.6, d: 0.35, h: 0.9 }),
      h("partition", 14.4, 4.3, 90, { w: 8.6, h: 2.9 }),
      h("track", 7.2, 3.1, 0, { w: 13.5, elev: 3.6 }), h("track", 7.2, 6.1, 0, { w: 13.5, elev: 3.6 }),
      // Полки на белой стене — только в середине, над 3-й и 4-й стойками: верхний ряд 60 см, нижний 40 см
      ...[6.75, 7.45, 8.9, 9.6].map((x) => h("wall_shelf", x, 0.15, 0, { elev: 2.35 })),
      ...[7.1, 8.18, 9.25].map((x) => h("wall_shelf_s", x, 0.15, 0, { elev: 1.95 })),
    ],
    zones: [
      { id: uid(), name: "Вход и ресепшен", x: 0, y: 0, w: 6, d: 5.6, color: "#a1a1aa", power: 2, role: "entry" },
      { id: uid(), name: "Фокус при входе в зал", x: HX, y: 1.0, w: 3.4, d: 3.1, color: "#ef4444", power: 5, role: "focus" },
      { id: uid(), name: "Обувь", x: HX, y: 4.1, w: 5.0, d: 4.5, color: "#f59e0b", power: 3, role: "back" },
      { id: uid(), name: "Центр", x: HX + 3.9, y: 3.3, w: 6.9, d: 3.1, color: "#3b82f6", power: 4, role: "center" },
      { id: uid(), name: "Белая стена", x: HX + 1.5, y: 0, w: 12.6, d: 1.0, color: "#10b981", power: 4, role: "wall" },
    ],
    background: null,
  }
}
