import { areaShares, areaTargets, DEFAULT_SETTINGS, MProduct } from "../autofill"
import { hitLine, offlineScore } from "../offline"

const base = { q30: 0, q60: 0, units: 5, sizesIn: 3, sizesAll: 4, price: 10000, cost: 5000, fresh: false, season: 0.8, outlet: false }

describe("офлайн-балл и роли", () => {
  it("продаётся лучше — балл выше", () => {
    expect(offlineScore({ ...base, q30: 8, q60: 12 }, 10).score).toBeGreaterThan(offlineScore({ ...base, q30: 1, q60: 2 }, 10).score)
  })
  it("роли", () => {
    const line = hitLine([10, 8, 2, 1, 0, 0])
    expect(offlineScore({ ...base, fresh: true }, 10, undefined, line).role).toBe("new")
    expect(offlineScore({ ...base, q30: 10, q60: 15 }, 10, undefined, line).role).toBe("hit")
    expect(offlineScore({ ...base, q30: 10, q60: 15, sizesIn: 1 }, 10, undefined, line).role).toBe("hit_broken")
    expect(offlineScore({ ...base, q60: 0, units: 6 }, 10, undefined, line).role).toBe("second_chance")
    expect(offlineScore({ ...base, season: 0.1 }, 10, undefined, line).role).toBe("offseason")
    expect(offlineScore({ ...base, outlet: true }, 10, undefined, line).role).toBe("sale")
  })
  it("запас в неделях", () => {
    expect(offlineScore({ ...base, q30: 3, units: 9 }, 10).weeks).toBeCloseTo(12.9, 1)
  })
})

describe("план площади", () => {
  const p = (brand: string, q60: number, units: number, i: number): MProduct =>
    ({ id: `${brand}${i}`, title: "", brand, cat: "kurtki", sub: null, color: null, thumb: null, sizes: ["M"], score: 1, price: 1, units, q60 })
  const ps = [...Array.from({ length: 10 }, (_, i) => p("A", 3, 2, i)), ...Array.from({ length: 10 }, (_, i) => p("B", 1, 2, i))]
  it("доли по продажам и остатку, ручная доля важнее", () => {
    const S = { ...DEFAULT_SETTINGS, area_plan: { enabled: true, mix: 0.5, shares: {} } }
    const sh = areaShares(ps, S)
    expect(sh[0].brand).toBe("A")
    expect(sh[0].share).toBeCloseTo(0.625, 3)
    expect(areaTargets(ps, 8, S).get("A")).toBe(5)
    const S2 = { ...S, area_plan: { ...S.area_plan, shares: { B: 75 } } }
    expect(areaTargets(ps, 8, S2).get("B")).toBe(6)
  })
})
