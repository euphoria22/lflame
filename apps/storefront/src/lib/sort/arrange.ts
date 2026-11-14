/**
 * Этап 2 (ТЗ, раздел 5): разведение соседей. Листинг заполняется сверху вниз: на каждую позицию —
 * карточка с максимальным баллом после штрафов за сходство с соседями выше:
 * Final = Score × 0.6^b × 0.75^c × 0.85^t × 0.9^p. Жёсткие ограничения отсекают кандидатов,
 * закреплённые карточки стоят на своих местах, каждая 6-я позиция — карточке без статистики.
 * Одинаковый вход всегда даёт одинаковый порядок.
 *
 * Файл без зависимостей: одинаковая копия лежит в backend и storefront (lib/sort/arrange.ts),
 * совпадение проверяет тест backend. Править — в backend и копировать.
 */

export type ArrangeItem = {
  id: string
  score: number
  brand: string | null
  /** Базовый цвет */
  color: string | null
  category: string | null
  /** Цена со скидкой */
  price: number
  /** Модель без цвета */
  model: string
  /** Мало показов — кандидат на квоту */
  low_stats?: boolean
}

export type ArrangeConfig = {
  penalties: { brand: number; color: number; category: number; price: number }
  windows: { brand: number; color: number; category: number; price: number }
  limits: {
    brand_run: number; brand_window: number; brand_in_window: number
    color_run: number; black_window: number; black_in_window: number
    price_run: number
    model_gap: number
  }
  candidates: number
  /** every = 0 — квота выключена (профиль «Запуск») */
  quota: { every: number; last: number }
}

export type Pin = { id: string; position: number; kind?: "pin" | "drop" }

export type Rule = "price" | "color" | "brand" | "model"
export type Placed = {
  id: string
  /** Позиция с 1 */
  position: number
  score: number
  final: number
  /** Сколько похожих соседей выше: бренд, цвет, категория, ценовой сегмент */
  near: { b: number; c: number; t: number; p: number }
  reason: "pin" | "drop" | "quota" | "algo"
  /** Карточка была лучшей по баллу, но её не пустило ограничение — сдвинута ниже */
  shifted?: Rule
  /** Ограничения, которые пришлось снять на этой позиции */
  relaxed?: Rule[]
}

const RELAX_ORDER: Rule[] = ["price", "color", "brand", "model"]

export function arrange<T extends ArrangeItem>(input: T[], cfg: ArrangeConfig, pins: Pin[] = []): Placed[] {
  const items = [...input].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const n = items.length
  if (!n) return []
  const index = new Map(items.map((it, i) => [it.id, i]))

  // Ценовой сегмент — треть листинга по цене
  const prices = items.map((i) => i.price).sort((a, b) => a - b)
  const t1 = prices[Math.floor((n - 1) / 3)], t2 = prices[Math.floor(((n - 1) * 2) / 3)]
  const seg = items.map((i) => (i.price <= t1 ? 0 : i.price <= t2 ? 1 : 2))

  // Правило не работает, если у признака в листинге одно значение (страница бренда, категория, фильтр по цвету)
  const distinct = (f: (i: T) => string | null) => new Set(items.map(f)).size > 1
  const on = { brand: distinct((i) => i.brand), color: distinct((i) => i.color), category: distinct((i) => i.category), price: new Set(seg).size > 1 }

  // Признаки — числами: сравнение соседей идёт сотни тысяч раз
  const intern = (f: (i: T) => string | null) => {
    const ids = new Map<string, number>()
    const arr = new Int32Array(n)
    items.forEach((it, i) => { const v = f(it); arr[i] = v === null ? -1 : ids.get(v) ?? (ids.set(v, ids.size), ids.size - 1) })
    return { arr, ids }
  }
  const B = intern((i) => i.brand), C = intern((i) => i.color), T_ = intern((i) => i.category), M = intern((i) => i.model)
  const brand = B.arr, color = C.arr, cat = T_.arr, model = M.arr
  const black = C.ids.get("black") ?? -2

  // Поправка на состав листинга: если доля бренда (чёрного) больше, чем пропускает базовый лимит, лимит в окне растёт
  const L = cfg.limits
  const grow = (cnt: number, base: number, window: number) => (cnt / n > base / window ? Math.max(base, Math.ceil((cnt / n) * window) + 1) : base)
  const brandTotal = new Int32Array(B.ids.size)
  for (let i = 0; i < n; i++) if (brand[i] >= 0) brandTotal[brand[i]]++
  const brandLimit = Array.from(brandTotal, (cnt) => grow(cnt, L.brand_in_window, L.brand_window))
  let blacks = 0
  for (let i = 0; i < n; i++) if (color[i] === black) blacks++
  const blackLimit = grow(blacks, L.black_in_window, L.black_window)

  const order = new Int32Array(n).fill(-1)
  const taken = new Uint8Array(n)
  const meta = new Map<number, Pick<Placed, "reason" | "shifted" | "relaxed">>()
  const shifted = new Map<number, Rule>()

  // Закрепления: на свои позиции (занято — следующая свободная)
  for (const p of [...pins].sort((a, b) => a.position - b.position)) {
    const i = index.get(p.id)
    if (i === undefined || taken[i]) continue
    let pos = Math.min(Math.max(1, p.position), n) - 1
    while (pos < n && order[pos] !== -1) pos++
    if (pos >= n) continue
    order[pos] = i
    taken[i] = 1
    meta.set(i, { reason: p.kind === "drop" ? "drop" : "pin" })
  }

  // Соседи выше текущей позиции: считаются один раз на позицию, кандидаты сверяются с готовыми счётчиками
  const W = cfg.windows
  const cBrandWin = new Int32Array(B.ids.size), cBrandPen = new Int32Array(B.ids.size)
  const cColorPen = new Int32Array(C.ids.size), cCatPen = new Int32Array(T_.ids.size), cSegPen = new Int32Array(3)
  const cModel = new Int32Array(M.ids.size)
  let cBlack = 0, runBrand = -1, runColor = -1, runSeg = -1
  /** Значение признака, если последние len позиций одинаковые; иначе -1 */
  const runOf = (pos: number, len: number, attr: Int32Array | number[]) => {
    if (pos < len || len < 1) return -1
    const v = attr[order[pos - 1]]
    for (let k = pos - 2; k >= pos - len; k--) if (attr[order[k]] !== v) return -1
    return v
  }
  const scan = (pos: number) => {
    cBrandWin.fill(0); cBrandPen.fill(0); cColorPen.fill(0); cCatPen.fill(0); cSegPen.fill(0); cModel.fill(0)
    cBlack = 0
    const far = Math.max(L.brand_window - 1, L.black_window - 1, L.model_gap, W.brand, W.color, W.category, W.price)
    for (let k = pos - 1, d = 1; k >= 0 && d <= far; k--, d++) {
      const j = order[k]
      if (brand[j] >= 0) { if (d <= L.brand_window - 1) cBrandWin[brand[j]]++; if (d <= W.brand) cBrandPen[brand[j]]++ }
      if (color[j] >= 0) { if (d <= W.color) cColorPen[color[j]]++; if (color[j] === black && d <= L.black_window - 1) cBlack++ }
      if (cat[j] >= 0 && d <= W.category) cCatPen[cat[j]]++
      if (d <= W.price) cSegPen[seg[j]]++
      if (d <= L.model_gap) cModel[model[j]]++
    }
    runBrand = runOf(pos, L.brand_run, brand)
    runColor = runOf(pos, L.color_run, color)
    runSeg = runOf(pos, L.price_run, seg)
  }
  /** Какое жёсткое ограничение нарушает кандидат на текущей позиции (с учётом снятых) */
  const violates = (i: number, off: Set<Rule>): Rule | null => {
    if (!off.has("model") && cModel[model[i]]) return "model"
    const b = brand[i]
    if (on.brand && b >= 0 && !off.has("brand") && (runBrand === b || cBrandWin[b] >= brandLimit[b])) return "brand"
    const c = color[i]
    if (on.color && c >= 0 && !off.has("color") && (runColor === c || (c === black && cBlack >= blackLimit))) return "color"
    if (on.price && !off.has("price") && runSeg === seg[i]) return "price"
    return null
  }
  const near = (i: number) => ({
    b: on.brand && brand[i] >= 0 ? cBrandPen[brand[i]] : 0,
    c: on.color && color[i] >= 0 ? cColorPen[color[i]] : 0,
    t: on.category && cat[i] >= 0 ? cCatPen[cat[i]] : 0,
    p: on.price ? cSegPen[seg[i]] : 0,
  })
  const P = cfg.penalties
  const final = (i: number, x: { b: number; c: number; t: number; p: number }) =>
    items[i].score * P.brand ** x.b * P.color ** x.c * P.category ** x.t * P.price ** x.p
  const NONE = new Set<Rule>()

  const out: Placed[] = new Array(n)
  let head = 0
  const place = (pos: number, i: number, m: Pick<Placed, "reason" | "shifted" | "relaxed">) => {
    order[pos] = i
    taken[i] = 1
    meta.set(i, m)
  }
  for (let pos = 0; pos < n; pos++) {
    scan(pos)
    if (order[pos] === -1) {
      while (head < n && taken[head]) head++
      // Квота: лучшая по баллу карточка без статистики, прошедшая ограничения
      const q = cfg.quota
      if (q.every > 0 && (pos + 1) % q.every === 0 && pos + 1 <= q.last) {
        let seen = 0
        for (let i = head; i < n && seen < cfg.candidates; i++) {
          if (taken[i] || !items[i].low_stats) continue
          seen++
          if (!violates(i, NONE)) { place(pos, i, { reason: "quota" }); break }
        }
      }
    }
    if (order[pos] === -1) {
      const cand: number[] = []
      for (let i = head; i < n && cand.length < cfg.candidates; i++) if (!taken[i]) cand.push(i)
      const off = new Set<Rule>()
      let pick = -1
      for (let step = 0; step <= RELAX_ORDER.length && pick === -1; step++) {
        let best = -Infinity
        for (const i of cand) {
          const v = violates(i, off)
          if (v) {
            // Лучшая по баллу карточка не прошла ограничение — запоминаем, почему она сдвинута
            if (step === 0 && i === cand[0] && !shifted.has(i)) shifted.set(i, v)
            continue
          }
          const f = final(i, near(i))
          if (f > best) { best = f; pick = i }
        }
        if (pick === -1) off.add(RELAX_ORDER[step])
      }
      if (pick === -1) pick = cand[0]
      place(pos, pick, { reason: "algo", ...(shifted.has(pick) ? { shifted: shifted.get(pick) } : {}), ...(off.size ? { relaxed: [...off] } : {}) })
    }
    const i = order[pos]
    const x = near(i)
    out[pos] = { id: items[i].id, position: pos + 1, score: items[i].score, final: final(i, x), near: x, ...meta.get(i)! }
  }
  return out
}

/** Действующее закрепление или дроп, как их отдаёт сервер */
export type StorePin = { id: string; listing: string | null; position: number; kind: "pin" | "drop" }

/**
 * Закрепления для листинга с ключом key (all, new, cat:kurtki, gender:men/cat:kurtki, brand:calvin-klein…):
 * закреплённые — на своих позициях, дропы — на первых свободных в «Новинках» и на странице своего бренда.
 */
export function pinsFor(pins: StorePin[], key: string, items: { id: string; brand: string | null }[]): Pin[] {
  const parts = key.split("/")
  const own = pins.filter((p) => p.kind === "pin" && p.listing === key).map((p) => ({ id: p.id, position: p.position, kind: "pin" as const }))
  const brandOf = new Map(items.map((i) => [i.id, i.brand]))
  const used = new Set(own.map((p) => p.position))
  let next = 1
  const drops = pins
    .filter((p) => p.kind === "drop" && brandOf.has(p.id) && (parts.includes("new") || parts.includes(`brand:${brandOf.get(p.id)}`)))
    .map((p) => {
      while (used.has(next)) next++
      used.add(next)
      return { id: p.id, position: next, kind: "drop" as const }
    })
  return [...own, ...drops]
}
