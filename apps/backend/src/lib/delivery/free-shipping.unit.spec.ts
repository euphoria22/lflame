import { applyFreeShipping, itemsTotal } from "./free-shipping"

describe("бесплатная доставка", () => {
  const env = process.env.FREE_SHIPPING_FROM
  afterEach(() => { process.env.FREE_SHIPPING_FROM = env })

  it("от 12 000 ₽ по умолчанию", () => {
    delete process.env.FREE_SHIPPING_FROM
    expect(applyFreeShipping(282, 11999)).toBe(282)
    expect(applyFreeShipping(282, 12000)).toBe(0)
  })
  it("порог 0 выключает", () => {
    process.env.FREE_SHIPPING_FROM = "0"
    expect(applyFreeShipping(282, 50000)).toBe(282)
  })
  it("сумма товаров", () => {
    expect(itemsTotal([{ unit_price: 5990, quantity: 2 }, { unit_price: "100", quantity: 1 }])).toBe(12080)
  })
})
