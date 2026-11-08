import { loginCodeMail, orderMail, shopOrderMessage } from "./templates"

const o = {
  display_id: 12, email: "a@b.ru", total: 13272, item_total: 12990, shipping_total: 282, payment_method: "cod",
  customer_name: "Анна, +79130000000", shipping_name: "СДЭК — пункт выдачи", address: "Новосибирск, мрн Горский, 53",
  items: [{ title: "Джинсы <Calvin>", variant: "32", quantity: 1, unit_price: 12990 }], tracking: { number: "111", url: "https://cdek.ru/t?111" },
}

describe("письма", () => {
  it("код входа", () => {
    const m = loginCodeMail("a@b.ru", "123456")
    expect(m.subject).toContain("123456")
    expect(m.html).toContain("123456")
  })
  it("заказ оформлен: позиции, итог, экранирование", () => {
    const m = orderMail("placed", o)
    expect(m.subject).toBe("Заказ № 12 оформлен")
    expect(m.html).toContain("13 272 ₽")
    expect(m.html).toContain("Джинсы &lt;Calvin&gt;")
    expect(m.html).not.toContain("<Calvin>")
    expect(m.text).toContain("Оплата — при получении")
  })
  it("передан в доставку — трек и кнопка отслеживания", () => {
    const m = orderMail("shipped", o)
    expect(m.html).toContain("111")
    expect(m.html).toContain("Отследить посылку")
  })
  it("самовывоз без повтора адреса", () => {
    const m = orderMail("placed", { ...o, shipping_name: "Самовывоз — Омск", address: "" })
    expect(m.html).not.toContain("<br></p>")
  })
  it("Telegram магазину", () => {
    const t = shopOrderMessage({ ...o, payment_method: "tbank" }, "http://x/app/orders/1")
    expect(t).toContain("Новый заказ № 12")
    expect(t).toContain("онлайн (оплачен)")
    expect(t).toContain("Джинсы &lt;Calvin&gt;")
  })
})
