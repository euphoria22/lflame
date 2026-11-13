import { buildReceipt, tbankToken, tbankVerify } from "./tbank-client"
import { createHash } from "node:crypto"

describe("Т-Касса", () => {
  it("подпись: сортировка ключей, без вложенных объектов", () => {
    const params = { TerminalKey: "TestDEMO", Amount: 19200, OrderId: "21090", Description: "Подарочная карта", DATA: { a: 1 }, Receipt: { b: 2 } }
    const expected = createHash("sha256").update("19200Подарочная карта21090secretTestDEMO").digest("hex")
    expect(tbankToken(params, "secret")).toBe(expected)
  })
  it("проверка уведомления", () => {
    const n: Record<string, unknown> = { TerminalKey: "TestDEMO", OrderId: "o1", Success: true, Status: "CONFIRMED", PaymentId: 13660, Amount: 100 }
    n.Token = tbankToken(n, "pw")
    expect(tbankVerify(n, "pw")).toBe(true)
    expect(tbankVerify({ ...n, Amount: 1 }, "pw")).toBe(false)
  })
  it("чек: суммы в копейках", () => {
    const r = buildReceipt([{ name: "Джинсы", price: 8690, quantity: 2 }, { name: "Доставка", price: 282, quantity: 1, kind: "service" }], { email: "a@b.ru" }, "usn_income")
    expect(r.Items.reduce((s, i) => s + i.Amount, 0)).toBe(1766200)
    expect(r.Items[1].PaymentObject).toBe("service")
  })
  it("чек с подарочной картой: зачёт аванса", () => {
    const r = buildReceipt([{ name: "Джинсы", price: 8690, quantity: 1 }, { name: "Доставка", price: 310, quantity: 1, kind: "service" }], { email: "a@b.ru" }, "usn_income", 3000)
    expect(r.Payments).toEqual({ Electronic: 600000, AdvancePayment: 300000 })
    expect(buildReceipt([{ name: "Джинсы", price: 8690, quantity: 1 }], { email: "a@b.ru" }, "usn_income").Payments).toBeUndefined()
  })
})

import { advanceOffsetReceipt } from "./cloudkassir"

describe("CloudKassir: чек зачёта аванса", () => {
  it("позиции — полный расчёт, оплата — только предоплатой на всю сумму", () => {
    const r = advanceOffsetReceipt([
      { label: "Футболка AVAVAV, S", price: 12990, quantity: 1, amount: 12990, kind: "commodity" },
      { label: "Доставка: СДЭК", price: 310, quantity: 1, amount: 310, kind: "service" },
    ], { inn: "550117485296", taxation: 1, email: "a@b.ru", invoiceId: "15" })
    expect(r.Type).toBe("Income")
    expect(r.CustomerReceipt.Amounts).toEqual({ AdvancePayment: 13300 })
    expect(r.CustomerReceipt.Items.map((i) => [i.Method, i.Object, i.Vat])).toEqual([[4, 1, null], [4, 4, null]])
    expect(r.CustomerReceipt.TaxationSystem).toBe(1)
  })
})
