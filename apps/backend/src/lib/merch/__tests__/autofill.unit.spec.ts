import { autofill, capacityOf, capsules, closedSides, railMetersOf, railUsedM, DEFAULT_SETTINGS, facingsOf, MerchSettings, MProduct, usedOf } from "../autofill"

const room = { width: 14, length: 8, openings: [{ kind: "door", wall: "bottom", offset: 6, width: 1.2 }] }
let n = 0
const prod = (brand: string, cat: string, score: number, color = "black", sizes = ["S", "M", "L"], extra: Partial<MProduct> = {}): MProduct =>
  ({ id: `p${++n}`, title: `${brand} ${cat}`, brand, cat, sub: null, color, thumb: null, sizes, score, price: 1000, units: 3, ...extra })
const pById = (list: MProduct[], id: string) => list.find((p) => p.id === id)!

describe("автораскладка", () => {
  const products = [
    ...Array.from({ length: 10 }, (_, i) => prod("CP", "kurtki", 0.9 - i * 0.01, i % 2 ? "white" : "black")),
    ...Array.from({ length: 10 }, (_, i) => prod("Stone", "futbolki-i-longslivy", 0.5 - i * 0.01)),
    ...Array.from({ length: 6 }, (_, i) => prod("Salomon", "obuv", 0.7 - i * 0.01, "grey", ["42"])),
    prod("CP", "golovnye-ubory", 0.6, "black", ["OS"]),
    prod("Stone", "golovnye-ubory", 0.65, "black", ["OS"]),
    prod("Nike", "kurtki", 0.99, "red", []), // нет размеров — не вешаем
  ]
  const near = { id: "near", type: "rack_base", x: 6.5, y: 7, w: 1.4, d: 0.45, h: 1.65 }
  const far = { id: "far", type: "rack_base", x: 1, y: 0.5, w: 1.4, d: 0.45, h: 1.65 }
  const shoes = { id: "shoes", type: "shoe_rack", x: 0.3, y: 4, w: 1.4, d: 0.45, h: 2.2 }
  const shelf = { id: "shelf", type: "wall_shelf", x: 1, y: 0.15, w: 0.6, d: 0.3, h: 0.15 }
  const res = autofill([far, near, shoes, shelf], [], room, products, {})

  it("у входа — лучший бренд, без товаров без размеров", () => {
    const brands = res.near.map((s) => pById(products, s.p).brand)
    expect(brands[0]).toBe("CP")
    expect(brands.includes("Nike")).toBe(false)
  })
  it("товар не дублируется", () => {
    const all = Object.values(res).flat().map((s) => s.p)
    expect(new Set(all).size).toBe(all.length)
  })
  it("штанга не переполнена: вешалки, толщина вещей и «лицом вперёд»", () => {
    expect(railUsedM(res.near, new Map(products.map((p) => [p.id, p])))).toBeLessThanOrEqual(capacityOf(near).railM + 1e-6)
  })
  it("куртка занимает больше штанги, чем футболка; лицом вперёд — ширину плечиков", () => {
    const jacket = prod("X", "kurtki", 1), tee = prod("X", "futbolki-i-longslivy", 1)
    expect(railMetersOf(jacket, 1, false)).toBeGreaterThan(railMetersOf(tee, 1, false) * 2)
    expect(railMetersOf(tee, 1, true)).toBeCloseTo(0.44, 2)
  })
  it("обувь — только на стеллаж, одежда на стойки", () => {
    expect(res.shoes.every((s) => pById(products, s.p).cat === "obuv")).toBe(true)
    expect(res.far.every((s) => pById(products, s.p).cat !== "obuv")).toBe(true)
  })
  it("полка над стойкой продолжает её бренд", () => {
    const rackBrand = pById(products, res.far[0].p).brand
    expect(pById(products, res.shelf[0].p).brand).toBe(rackBrand)
  })
  it("главная вещь капсулы — лицом вперёд", () => {
    expect(res.near[0].face).toBe(true)
  })
  it("закреплённое не меняется", () => {
    const r2 = autofill([{ ...near, lock: true }, far], [], room, products, { near: [{ p: "p20", n: 1, place: "rail" }] })
    expect(r2.near).toEqual([{ p: "p20", n: 1, place: "rail" }])
    expect(r2.far.some((s) => s.p === "p20")).toBe(false)
  })
  it("зона входа: стойки не заполняются; распродажа — только Outlet", () => {
    const zones = [{ x: 5, y: 6, w: 3, d: 2, power: 5, role: "entry" as const }, { x: 0, y: 0, w: 2, d: 1, power: 1, role: "sale" as const }]
    const withOutlet = [...products, prod("CP", "kurtki", 0.1, "black", ["M"], { outlet: true })]
    const r = autofill([near, far], zones, room, withOutlet, {})
    expect(r.near).toBeUndefined()
    expect(r.far.every((s) => pById(withOutlet, s.p).outlet)).toBe(true)
  })
})

describe("уровни и капсулы", () => {
  const S: MerchSettings = { ...DEFAULT_SETTINGS, brands: { Lux: { level: "luxury" }, Br: { level: "bridge" } } }
  it("люкс — один размер, bridge — до 5", () => {
    const sizes = ["XS", "S", "M", "L", "XL", "XXL"]
    expect(facingsOf(prod("Lux", "kurtki", 1, "black", sizes), "rail", S)).toBe(1)
    expect(facingsOf(prod("Br", "kurtki", 1, "black", sizes), "rail", S)).toBe(5)
  })
  it("капсула: главная вещь, затем по слоям, цвет главной + нейтральные", () => {
    const list = [
      prod("A", "futbolki-i-longslivy", 0.5, "green"), prod("A", "kurtki", 0.9, "green"), prod("A", "bryuki", 0.6, "black"),
      prod("A", "hudi-i-svitshoty", 0.7, "white"), prod("A", "kurtki", 0.4, "red"),
    ]
    const [first] = capsules(list)
    expect(first.map((p) => p.cat)).toEqual(["kurtki", "hudi-i-svitshoty", "futbolki-i-longslivy", "bryuki"])
    expect(first.some((p) => p.color === "red")).toBe(false)
  })
})

describe("образы мерчендайзера", () => {
  it("манекен — из образа, вещи образа висят на ближайшей стойке первыми, лицом вперёд", () => {
    const ps = [prod("A", "kurtki", 0.2, "green"), prod("A", "bryuki", 0.2, "black"), ...Array.from({ length: 8 }, (_, i) => prod("B", "kurtki", 0.9 - i * 0.01))]
    const S: MerchSettings = { ...DEFAULT_SETTINGS, looks: [{ id: "l1", name: "Образ", place: "mannequin", products: [ps[0].id, ps[1].id], active: true }] }
    const man = { id: "man", type: "mannequin", x: 3, y: 3, w: 0.5, d: 0.35, h: 1.85 }
    const rack = { id: "rack", type: "rack_base", x: 4, y: 3, w: 1.4, d: 0.45, h: 1.65 }
    const r = autofill([man, rack], [], room, ps, {}, { settings: S })
    expect(r.man.map((s) => s.p)).toEqual([ps[0].id, ps[1].id])
    expect(r.rack[0]).toMatchObject({ p: ps[0].id, face: true })
    expect(r.rack.some((s) => s.p === ps[1].id)).toBe(true)
  })
})

describe("пол", () => {
  it("рейл «только женское»: мужское не вешается, унисекс — можно", () => {
    const ps = [prod("A", "kurtki", 0.9, "black", ["S"], { gender: "men" }), prod("A", "kurtki", 0.8, "black", ["S"], { gender: "women" }), prod("A", "kurtki", 0.7, "black", ["S"], { gender: "unisex" })]
    const r = autofill([{ id: "w", type: "rack_base", x: 3, y: 3, w: 1.4, d: 0.45, h: 1.65, gender: "women" }], [], room, ps, {})
    expect(r.w.map((s) => pById(ps, s.p).gender).sort()).toEqual(["unisex", "women"])
  })
})

describe("квадратная стойка у колонны", () => {
  it("сторона к колонне закрыта, штанга считается по открытым сторонам", () => {
    const sq = { id: "sq", type: "rack_square", x: 5, y: 4, w: 1.3, d: 1.5, h: 1.4, rot: 0 }
    const col = { id: "c", type: "column", x: 4.0, y: 4, w: 0.5, d: 0.5, h: 4 }
    const closed = closedSides(sq, [sq, col], { width: 14, length: 8 })
    expect(closed).toEqual(["left"])
    const len = capacityOf({ ...sq, closed }).railM
    expect(len).toBeCloseTo(2 * 1.2 + 1.4, 5)
  })
})

describe("корнер бренда и микс", () => {
  const ps = [...Array.from({ length: 6 }, (_, i) => prod("A", "kurtki", 0.9 - i * 0.01)), ...Array.from({ length: 6 }, (_, i) => prod("B", "kurtki", 0.8 - i * 0.01))]
  const rack = { id: "r", type: "rack_base", x: 3, y: 3, w: 1.8, d: 0.4, h: 1.55 }
  it("зона-корнер: только её бренд", () => {
    const r = autofill([rack], [{ x: 2, y: 2, w: 2, d: 2, power: 3, brands: ["B"] }], room, ps, {})
    expect(r.r.every((s) => pById(ps, s.p).brand === "B")).toBe(true)
  })
  it("микс: разные бренды на одной стойке", () => {
    const r = autofill([{ ...rack, w: 4 }], [], room, ps, {}, { settings: { ...DEFAULT_SETTINGS, levels: { ...DEFAULT_SETTINGS.levels, premium: { ...DEFAULT_SETTINGS.levels.premium, spacing: 1 } } } })
    const r2 = autofill([{ ...rack, w: 4, mix: true }], [], room, ps, {})
    expect(new Set(r2.r.map((s) => pById(ps, s.p).brand)).size).toBe(2)
    expect(r.r.length).toBeGreaterThan(0)
  })
})
