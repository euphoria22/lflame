import { buildCart, decodeJwtPayload, isPaidOnline, toSessionStatus } from "../yandex-pay-client"
import { sessionIdOf } from "../../../modules/yandex-split/service"

describe("Яндекс Сплит", () => {
  it("корзина: позиции, доставка — услуга, суммы строками с копейками", () => {
    const cart = buildCart([
      { name: "Худи, M", price: 7990, quantity: 2 },
      { name: "Доставка", price: 350.5, quantity: 1, kind: "service" },
    ])
    expect(cart.total.amount).toBe("16330.50")
    expect(cart.items[0]).toMatchObject({ quantity: { count: "2" }, unitPrice: "7990.00", total: "15980.00", receipt: { tax: 6, paymentSubjectType: 1 } })
    expect(cart.items[1].receipt.paymentSubjectType).toBe(4)
  })

  it("статусы платежа", () => {
    expect(toSessionStatus("CAPTURED")).toBe("captured")
    expect(toSessionStatus("AUTHORIZED")).toBe("authorized")
    expect(toSessionStatus("FAILED")).toBe("error")
    expect(toSessionStatus("PENDING")).toBe("pending")
  })

  it("payload вебхука и номер сессии", () => {
    const body = Buffer.from(JSON.stringify({ event: "ORDER_STATUS_UPDATED", order: { orderId: "payses_01ABC.2", paymentStatus: "CAPTURED" } })).toString("base64url")
    expect(decodeJwtPayload(`eyJhbGciOiJFUzI1NiJ9.${body}.sig`)).toMatchObject({ order: { orderId: "payses_01ABC.2" } })
    expect(sessionIdOf("payses_01ABC.2")).toBe("payses_01ABC")
    expect(decodeJwtPayload("garbage")).toBeNull()
    expect(isPaidOnline("split")).toBe(true)
  })
})
