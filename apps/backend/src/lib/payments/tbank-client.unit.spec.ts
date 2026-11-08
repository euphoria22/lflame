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
})
