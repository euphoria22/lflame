import { autofill, capacityOf, MProduct, usedOf } from "../autofill"

const room = { width: 14, length: 8, openings: [{ kind: "door", wall: "bottom", offset: 6, width: 1.2 }] }
let n = 0
const prod = (brand: string, cat: string, score: number, color = "black", sizes = ["S", "M", "L"]): MProduct =>
  ({ id: `p${++n}`, title: `${brand} ${cat}`, brand, cat, sub: null, color, thumb: null, sizes, score, price: 1000, units: 3 })

describe("автораскладка", () => {
  const products = [
    ...Array.from({ length: 10 }, (_, i) => prod("CP", "kurtki", 0.9 - i * 0.01, i % 2 ? "white" : "black")),
    ...Array.from({ length: 10 }, (_, i) => prod("Stone", "futbolki-i-longslivy", 0.8 - i * 0.01)),
    ...Array.from({ length: 6 }, (_, i) => prod("Salomon", "obuv", 0.7 - i * 0.01, "grey", ["42"])),
    prod("CK", "sumki-i-ryukzaki", 0.5, "black", ["OS"]),
    prod("Nike", "kurtki", 0.99, "red", []), // нет размеров — не вешаем
  ]
  const near = { id: "near", type: "rack_base", x: 6.5, y: 7, w: 1.4, d: 0.45, h: 1.65 }
  const far = { id: "far", type: "rack_base", x: 1, y: 0.5, w: 1.4, d: 0.45, h: 1.65 }
  const shoes = { id: "shoes", type: "shoe_rack", x: 0.3, y: 4, w: 1.4, d: 0.45, h: 2.2 }
  const res = autofill([far, near, shoes], [], room, products, {})

  it("у входа — лучший бренд, без товаров без размеров", () => {
    const ids = res.near.map((s) => s.p)
    const brands = new Set(ids.map((id) => products.find((p) => p.id === id)!.brand))
    expect([...brands][0]).toBe("CP")
    expect(ids.some((id) => products.find((p) => p.id === id)!.brand === "Nike")).toBe(false)
  })
  it("вместимость не превышена, товар не дублируется", () => {
    expect(usedOf(res.near).rail).toBeLessThanOrEqual(capacityOf(near).rail)
    const all = Object.values(res).flat().map((s) => s.p)
    expect(new Set(all).size).toBe(all.length)
  })
  it("обувь — только на стеллаж, одежда на стойки", () => {
    expect(res.shoes.every((s) => products.find((p) => p.id === s.p)!.cat === "obuv")).toBe(true)
    expect(res.far.every((s) => products.find((p) => p.id === s.p)!.cat !== "obuv")).toBe(true)
  })
  it("на стойке — от светлого к тёмному внутри категории", () => {
    const colors = res.near.map((s) => products.find((p) => p.id === s.p)!).filter((p) => p.cat === "kurtki").map((p) => p.color)
    expect(colors.indexOf("white")).toBeLessThan(colors.lastIndexOf("black"))
  })
  it("закреплённое не меняется", () => {
    const r2 = autofill([{ ...near, lock: true }, far], [], room, products, { near: [{ p: "p20", n: 1, place: "rail" }] })
    expect(r2.near).toEqual([{ p: "p20", n: 1, place: "rail" }])
    expect(r2.far.some((s) => s.p === "p20")).toBe(false)
  })
})
