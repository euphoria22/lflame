import { estimateParcel, itemWeight } from "../parcel"

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
