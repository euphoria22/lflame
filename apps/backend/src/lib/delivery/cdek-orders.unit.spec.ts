import { buildCdekOrder, CdekOrderInput } from "./cdek-orders"

const base: CdekOrderInput = {
  displayId: 15,
  kind: "pvz",
  cityCode: 270,
  pvzCode: "NSK23",
  recipient: { name: "Иван Петров", phone: "8 (900) 000-00-00", email: "a@b.ru" },
  items: [{ id: "li_1", title: "28", product_title: "Джинсы MISBHV", sku: "MS-1", quantity: 1, unit_price: 31990 }],
  cod: true,
  shippingAmount: 282,
}

describe("заказ СДЭК", () => {
  it("пункт выдачи, наложенный платёж", () => {
    const b = buildCdekOrder(base, false) as ReturnType<typeof buildCdekOrder> & { delivery_point?: string }
    expect(b.number).toBe("LF-15")
    expect(b.tariff_code).toBe(136)
    expect(b.delivery_point).toBe("NSK23")
    expect(b.shipment_point).toBe("OMS6")
    expect(b.delivery_recipient_cost.value).toBe(282)
    expect(b.packages[0].items[0]).toMatchObject({ name: "Джинсы MISBHV", ware_key: "MS-1", cost: 31990, payment: { value: 31990 }, weight: 800, amount: 1 })
    expect(b.recipient.phones[0].number).toBe("+79000000000")
  })
  it("курьер, оплачено онлайн", () => {
    const b = buildCdekOrder({ ...base, kind: "door", pvzCode: null, address: "ул. Ленина, 1", cod: false }, true) as ReturnType<typeof buildCdekOrder> & { to_location?: unknown }
    expect(b.tariff_code).toBe(137)
    expect(b.to_location).toEqual({ code: 270, address: "ул. Ленина, 1" })
    expect(b.delivery_recipient_cost.value).toBe(0)
    expect(b.packages[0].items[0].payment.value).toBe(0)
    expect(b.number).toMatch(/^LF-15-/)
  })
})
