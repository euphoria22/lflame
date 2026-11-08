import { applyFreeShipping, applyMarkup, itemsTotal } from "./free-shipping"
import { defaultSettings, validateSettings } from "../settings/shop-settings"

describe("бесплатная доставка", () => {
  it("порог", () => {
    expect(applyFreeShipping(282, 11999, 12000)).toBe(282)
    expect(applyFreeShipping(282, 12000, 12000)).toBe(0)
    expect(applyFreeShipping(282, 50000, 0)).toBe(282)
  })
  it("сумма товаров", () => {
    expect(itemsTotal([{ unit_price: 5990, quantity: 2 }, { unit_price: "100", quantity: 1 }])).toBe(12080)
  })
  it("настройки по умолчанию и проверка", () => {
    delete process.env.FREE_SHIPPING_FROM
    expect(defaultSettings().free_shipping_from).toBe(12000)
    expect(validateSettings({ free_shipping_from: -1 }).error).toBeTruthy()
    expect(validateSettings({ free_shipping_from: "15000.4" as unknown as number }).value).toEqual({ free_shipping_from: 15000 })
    expect(validateSettings({ cdek_shipment_point: " oms9 " }).value).toEqual({ cdek_shipment_point: "OMS9" })
  })
})

describe("наценка на доставку", () => {
  it("рубли и проценты, округление вверх", () => {
    expect(applyMarkup(282)).toBe(282)
    expect(applyMarkup(282, { type: "rub", value: 100 })).toBe(382)
    expect(applyMarkup(282, { type: "pct", value: 10 })).toBe(311)
  })
  it("проверка настроек", () => {
    expect(validateSettings({ markup: { cdek: { type: "pct", value: 500 }, pochta: { type: "rub", value: 0 } } }).error).toBeTruthy()
    expect(validateSettings({ markup: { cdek: { type: "pct", value: 15 }, pochta: { type: "rub", value: 50 } } }).value?.markup)
      .toEqual({ cdek: { type: "pct", value: 15 }, pochta: { type: "rub", value: 50 } })
  })
})
