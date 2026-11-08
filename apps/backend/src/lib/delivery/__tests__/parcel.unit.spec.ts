import { DEFAULT_PARCEL, estimateParcel, itemWeight, validateParcelConfig } from "../parcel"

describe("parcel", () => {
  it("вес по типу товара", () => {
    expect(itemWeight({ product_title: "Пуховик C.P. Company Chrome-R", quantity: 1 })).toBe(2000)
    expect(itemWeight({ product_title: "Футболка Calvin Klein Logo", quantity: 1 })).toBe(350)
    expect(itemWeight({ product_title: "Кеды Maison Margiela Tabi", quantity: 1 })).toBe(1500)
    expect(itemWeight({ product_title: "Что-то непонятное", quantity: 1 })).toBe(700)
  })
  it("вес варианта важнее", () => {
    expect(itemWeight({ product_title: "Футболка", quantity: 1, variant: { weight: 500 } })).toBe(500)
  })
  it("посылка из нескольких вещей", () => {
    const p = estimateParcel([{ product_title: "Худи", quantity: 2 }, { product_title: "Кепка", quantity: 1 }])
    expect(p).toEqual({ weight: 1650, length: 35, width: 25, height: 15 })
  })
})

describe("parcel: габариты товара и настройки", () => {
  it("заполненные габариты варианта/товара важнее коробки", () => {
    const p = estimateParcel([
      { product_title: "Кроссовки", quantity: 1, variant: { length: 40, width: 28, height: 15 } },
      { product_title: "Футболка", quantity: 2, variant: { product: { weight: 300 } } },
    ])
    expect(p).toEqual({ weight: 2100, length: 40, width: 28, height: 25 })
  })
  it("свои правила веса и коробка", () => {
    const cfg = { ...DEFAULT_PARCEL, box_length: 30, fallback_weight: 500, weights: [{ keywords: "футболк", weight: 200 }] }
    expect(estimateParcel([{ product_title: "Футболка Stone Island", quantity: 1 }], cfg)).toMatchObject({ weight: 200, length: 30 })
    expect(itemWeight({ product_title: "Пуховик", quantity: 1 }, cfg)).toBe(500)
  })
  it("проверка настроек", () => {
    expect(validateParcelConfig({ box_length: 0 }).error).toBeTruthy()
    expect(validateParcelConfig({ min_height: 70, max_height: 60 }).error).toBeTruthy()
    expect(validateParcelConfig({ weights: [{ keywords: " худи ", weight: 650.4 }, { keywords: "", weight: 1 }] }).value?.weights).toEqual([{ keywords: "худи", weight: 650 }])
  })
})
