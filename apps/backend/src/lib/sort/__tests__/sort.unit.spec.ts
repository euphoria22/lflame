import { readFileSync } from "fs"
import { join } from "path"
import { arrange, ArrangeItem } from "../arrange"
import { DEFAULT_CONFIG, mergeConfig, validateConfig } from "../config"
import { CardInput, scoreCards, sizeKey, sizeScore } from "../score"
import { blend, collectionFactor, matrixRow, seasonState, seasonZ } from "../season"

const cfg = DEFAULT_CONFIG
const card = (over: Partial<CardInput> = {}): CardInput => ({
  id: "p1", category: "hudi-i-svitshoty", brand: "ck", row: "hoodies", warmth: null, collection: "FW26", age_days: 10,
  orders_30d: 2, impressions_30d: 0, clicks_30d: 0, carts_30d: 0, sizes: ["XS", "S", "M", "L", "XL", "XXL"], sizes_in_stock: ["S", "M", "L", "XL"],
  size_group: "top", stock_units: 8, price: 10000, compare_at: null, cost: null, preorder: false, in_stock: true, photos: 3, manual: 1, manual_notes: [], ...over,
})

describe("балл товара", () => {
  it("контрольный пример из ТЗ: 0.697", () => {
    // Зима, базовый профиль, I = 0.5, M = 0.6, максимум продаж в категории 6
    const c = { ...cfg, profile: "base" as const, margin_weight: 0, brand_weight: 1, brand_priority: { ck: 0.6 } }
    // I = 0.5: у карточки интерес вдвое ниже 95-го перцентиля категории
    const top = card({ id: "p0", orders_30d: 6, impressions_30d: 1000, clicks_30d: 100, age_days: 400 })
    const cards = [card({ impressions_30d: 1000, clicks_30d: 46 }), top, ...Array.from({ length: 30 }, (_, i) => card({ id: `x${i}`, orders_30d: 0, impressions_30d: 1000, clicks_30d: 100 }))]
    const s = scoreCards(cards, "central", { cfg: c, now: new Date("2026-12-20T00:00:00Z"), stats_days: 100, sale: false })[0]
    expect(s.profile).toBe("base")
    expect(s.components.N).toBeCloseTo(0.717, 3)
    expect(s.components.S).toBeCloseTo(0.565, 3)
    expect(s.components.R).toBeCloseTo(0.9, 5)
    expect(s.components.Z).toBeCloseTo(0.9, 5)
    expect(s.components.M).toBeCloseTo(0.6, 5)
    expect(s.components.I).toBeCloseTo(0.5, 1)
    const score = 0.25 * s.components.N + 0.2 * s.components.S + 0.15 * 0.5 + 0.15 * s.components.R + 0.15 * s.components.Z + 0.1 * s.components.M
    expect(score).toBeGreaterThan(0.692)
    expect(score).toBeLessThan(0.702)
  })

  it("множители: один размер, предзаказ, запас, распродажа, нет в наличии", () => {
    const ctx = { cfg, now: new Date("2026-12-20T00:00:00Z"), stats_days: 100, sale: false }
    const k = (c: CardInput, sale = false) => scoreCards([c], "central", { ...ctx, sale })[0]
    expect(k(card({ sizes_in_stock: ["M"] })).k).toBeCloseTo(0.5)
    expect(k(card({ preorder: true })).k).toBeCloseTo(0.7)
    expect(k(card({ age_days: 60, orders_30d: 1, stock_units: 20 })).k).toBeCloseTo(1.15)
    expect(k(card({ age_days: 60, orders_30d: 30, stock_units: 20 })).k).toBe(1)
    expect(k(card({ compare_at: 20000 })).k).toBe(1)
    expect(k(card({ compare_at: 20000 }), true).k).toBeCloseTo(1.5)
    expect(k(card({ compare_at: 12500 }), true).k).toBeCloseTo(1.2)
    expect(k(card({ in_stock: false, sizes_in_stock: [] })).score).toBe(0)
    expect(k(card({ manual: 1.3, manual_notes: ["буст бренда"] })).k).toBeCloseTo(1.3)
  })

  it("размеры: справочник спроса, без сетки — 1", () => {
    expect(sizeKey("46 (S)")).toBe("S")
    expect(sizeKey("2XL")).toBe("XXL")
    expect(sizeScore(card(), cfg)).toBeCloseTo(0.9)
    expect(sizeScore(card({ sizes: ["One Size"], sizes_in_stock: ["One Size"], size_group: "none" }), cfg)).toBe(1)
    expect(sizeScore(card({ sizes: ["30", "31", "32", "33"], sizes_in_stock: ["31", "32"], size_group: "bottom" }), cfg)).toBeCloseTo(0.5)
  })

  it("профиль: запуск без статистики, начало и конец сезона", () => {
    const p = (now: string, stats: number) => scoreCards([card()], "central", { cfg, now: new Date(now), stats_days: stats, sale: false })[0].profile
    expect(p("2026-12-20T00:00:00Z", 3)).toBe("launch")
    expect(p("2026-11-20T00:00:00Z", 30)).toBe("season_start")
    expect(p("2026-12-25T00:00:00Z", 30)).toBe("base")
    expect(p("2027-02-01T00:00:00Z", 30)).toBe("season_end")
  })
})

describe("сезонность", () => {
  it("на 10-й день после границы W — смесь с t = 10/21", () => {
    const st = seasonState(new Date("2026-11-11T12:00:00Z"), "central", cfg)
    expect(st.season).toBe("winter")
    expect(st.prev).toBe("autumn")
    expect(st.t).toBeCloseTo(10 / 21)
    expect(blend(cfg.matrix.puffers, st)).toBeCloseTo((1 - 10 / 21) * 0.8 + (10 / 21) * 1)
  })

  it("15 ноября по зонам: центральная — смесь 14/21, южная — осень, холодная — зима", () => {
    const now = new Date("2026-11-15T00:00:00Z")
    const c = seasonState(now, "central", cfg), s = seasonState(now, "south", cfg), h = seasonState(now, "cold", cfg)
    expect([c.season, c.prev]).toEqual(["winter", "autumn"])
    expect(c.t).toBeCloseTo(14 / 21)
    expect(s.season).toBe("autumn")
    expect(s.t).toBe(1)
    expect(h.season).toBe("winter")
    expect(h.t).toBe(1)
  })

  it("коллекция: текущая, вне сезона, прошлая, противоположная", () => {
    const st = seasonState(new Date("2027-01-15T00:00:00Z"), "central", cfg)
    expect(collectionFactor("FW26", st, cfg)).toBe(1)
    expect(collectionFactor(null, st, cfg)).toBe(0.9)
    expect(collectionFactor("FW25", st, cfg)).toBe(0.85)
    expect(collectionFactor("SS26", st, cfg)).toBe(0.6)
    const summer = seasonState(new Date("2027-06-15T00:00:00Z"), "central", cfg)
    expect(collectionFactor("SS27", summer, cfg)).toBe(1)
    expect(collectionFactor("FW26", summer, cfg)).toBe(0.6)
  })

  it("утеплённость важнее категории; Z не ниже 0.1", () => {
    const st = seasonState(new Date("2027-01-15T00:00:00Z"), "central", cfg)
    expect(seasonZ({ row: "light_jackets", warmth: null, collection: "FW26" }, st, cfg).z).toBeCloseTo(0.2)
    expect(seasonZ({ row: "light_jackets", warmth: "warm", collection: "FW26" }, st, cfg).z).toBeCloseTo(1)
    expect(seasonZ({ row: "shorts", warmth: null, collection: "SS26" }, st, cfg).z).toBe(0.1)
  })

  it("строка матрицы по разделу и названию", () => {
    expect(matrixRow("kurtki", "Пуховик Tommy Hilfiger")).toBe("puffers")
    expect(matrixRow("kurtki", "Ветровка Stone Island")).toBe("light_jackets")
    expect(matrixRow("golovnye-ubory", "Кепка Polo Ralph Lauren")).toBe("caps")
    expect(matrixRow("golovnye-ubory", "Шапка C.P. Company")).toBe("winter_hats")
    expect(matrixRow("obuv", "Кеды Polo Ralph Lauren")).toBe("sneakers")
    expect(matrixRow("futbolki-i-longslivy", "Лонгслив Yeezy Gap")).toBe("longsleeves")
    expect(matrixRow("nizhnee-bele-i-noski", "Трусы Calvin Klein")).toBe("accessories")
  })
})

describe("разведение соседей", () => {
  const brands = ["a", "b", "c", "d"], colors = ["black", "white", "grey", "blue", "green"], cats = ["x", "y", "z"]
  // Детерминированный «случайный» листинг: бренд a (30%) и чёрный (30%) встречаются чаще, но не больше трети
  const listing = (n: number): ArrangeItem[] => Array.from({ length: n }, (_, i) => {
    const r = (k: number) => ((i * 2654435761 + k * 40503) >>> 0) % 1000 / 1000
    return {
      id: `p${String(i).padStart(4, "0")}`, score: 1 - i / n, brand: brands[[30, 54, 77, 100].findIndex((x) => (i * 7919) % 100 < x)],
      color: r(3) < 0.3 ? "black" : colors[1 + Math.floor(r(4) * 4)], category: cats[Math.floor(r(5) * 3)], price: 3000 + Math.floor(r(6) * 20000),
      model: `m${i}`, low_stats: false,
    }
  })
  const A = { penalties: cfg.penalties, windows: cfg.windows, limits: cfg.limits, candidates: cfg.candidates, quota: { every: 0, last: 0 } }
  const items = listing(300)
  const by = new Map(items.map((i) => [i.id, i]))
  const top = arrange(items, A).slice(0, 48).map((p) => by.get(p.id)!)

  it("бренд: нет 3 подряд и нет 5 в любых 12", () => {
    for (let i = 2; i < top.length; i++) expect(top[i].brand === top[i - 1].brand && top[i].brand === top[i - 2].brand).toBe(false)
    for (let i = 0; i + 12 <= top.length; i++) {
      const w = top.slice(i, i + 12)
      for (const b of brands) expect(w.filter((x) => x.brand === b).length).toBeLessThan(5)
    }
  })

  it("цвет: нет 3 подряд и нет 5 чёрных в любых 8", () => {
    for (let i = 2; i < top.length; i++) expect(top[i].color === top[i - 1].color && top[i].color === top[i - 2].color).toBe(false)
    for (let i = 0; i + 8 <= top.length; i++) expect(top.slice(i, i + 8).filter((x) => x.color === "black").length).toBeLessThan(5)
  })

  it("два цвета одной модели — не ближе 8 позиций", () => {
    const list = listing(60).map((i, k) => (k < 3 ? { ...i, model: "same", score: 0.99 - k / 1000 } : i))
    const pos = arrange(list, A).filter((p) => ["p0000", "p0001", "p0002"].includes(p.id)).map((p) => p.position)
    expect(pos[1] - pos[0]).toBeGreaterThan(8)
    expect(pos[2] - pos[1]).toBeGreaterThan(8)
  })

  it("на странице бренда правило по бренду выключено, в категории — по категории", () => {
    const one = listing(40).map((i) => ({ ...i, brand: "a", category: "x" }))
    const res = arrange(one, A)
    expect(res).toHaveLength(40)
    expect(res.every((p) => p.near.b === 0 && p.near.t === 0)).toBe(true)
    expect(res.some((p) => p.relaxed?.includes("brand"))).toBe(false)
  })

  it("одинаковый вход — одинаковый порядок; все карточки на месте, без дублей", () => {
    const a = arrange(items, A).map((p) => p.id), b = arrange([...items].reverse(), A).map((p) => p.id)
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(items.length)
    // Страницы 1 и 2 не содержат общих карточек
    expect(a.slice(0, 24).some((id) => a.slice(24, 48).includes(id))).toBe(false)
  })

  it("закрепление: карточка на своей позиции, соседи разводятся вокруг", () => {
    const res = arrange(items, A, [{ id: "p0299", position: 3 }, { id: "p0298", position: 1, kind: "drop" }])
    expect(res[2]).toMatchObject({ id: "p0299", reason: "pin" })
    expect(res[0]).toMatchObject({ id: "p0298", reason: "drop" })
    // Правило закончилось — позиция освобождается
    expect(arrange(items, A)[2].id).not.toBe("p0299")
  })

  it("квота: каждая 6-я позиция — карточке без статистики", () => {
    const list = items.map((i, k) => ({ ...i, low_stats: k >= 200 }))
    const res = arrange(list, { ...A, quota: { every: 6, last: 48 } })
    for (const p of [6, 12, 18, 24, 30, 36, 42, 48]) expect(res[p - 1].reason).toBe("quota")
    expect(res[53].reason).toBe("algo")
  })

  it("доля бренда большая — лимит в окне растёт, порядок всё равно собирается", () => {
    const list = listing(100).map((i, k) => ({ ...i, brand: k % 10 < 7 ? "a" : "b" }))
    expect(arrange(list, A)).toHaveLength(100)
  })

  it("3000 карточек — не дольше 50 мс", () => {
    const big = listing(3000)
    arrange(big, A)
    const t = process.hrtime.bigint()
    arrange(big, { ...A, quota: { every: 6, last: 48 } })
    expect(Number(process.hrtime.bigint() - t) / 1e6).toBeLessThan(50)
  })

  it("копия в storefront совпадает", () => {
    const here = readFileSync(join(__dirname, "../arrange.ts"), "utf8")
    const there = readFileSync(join(__dirname, "../../../../../storefront/src/lib/sort/arrange.ts"), "utf8")
    expect(there).toBe(here)
  })
})

describe("настройки", () => {
  it("сумма весов профиля = 1", () => {
    expect(validateConfig(cfg).value).toBeTruthy()
    expect(validateConfig({ ...cfg, profiles: { ...cfg.profiles, base: { ...cfg.profiles.base, N: 0.5 } } }).error).toMatch(/сумма весов/)
  })
  it("старая версия без новых полей дополняется стартовыми значениями", () => {
    const c = mergeConfig({ novelty_days: 45, brand_priority: { ck: 0.9 } })
    expect(c.novelty_days).toBe(45)
    expect(c.brand_priority.ck).toBe(0.9)
    expect(c.penalties.brand).toBe(0.6)
  })
})
