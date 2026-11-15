import { abandonedCartMail } from "../../notify/templates"
import { checkRestoreToken, restoreToken, restoreUrl } from "../abandoned"

describe("брошенная корзина", () => {
  it("ссылка восстановления: подпись проверяется, чужая корзина без подписи не открывается", () => {
    process.env.COOKIE_SECRET = "test-secret"
    const t = restoreToken("cart_1")
    expect(checkRestoreToken("cart_1", t)).toBe(true)
    expect(checkRestoreToken("cart_2", t)).toBe(false)
    expect(checkRestoreToken("cart_1", "x")).toBe(false)
    expect(restoreUrl("cart_1")).toContain(`/cart/restore?c=cart_1&t=${t}`)
  })
  it("письмо: товары, кнопка, промокод, отписка", () => {
    const m = abandonedCartMail("a@b.ru", {
      items: [{ title: "Худи CK", variant: "M", quantity: 2, price: 5000, image: "https://x/1.jpg", url: "https://x/p" }],
      restoreUrl: "https://site/cart/restore?c=1&t=2", code: "BACK-ABC123", pct: 5, unsubscribeUrl: "https://site/unsubscribe?e=a",
    })
    expect(m.subject).toBe("Вы оставили товары в корзине")
    expect(m.html).toContain("Худи CK")
    expect(m.html).toContain("10 000 ₽")
    expect(m.html).toContain("BACK-ABC123")
    expect(m.html).toContain("https://site/cart/restore?c=1&amp;t=2")
    expect(m.html).toContain("отпишитесь")
    expect(abandonedCartMail("a@b.ru", { items: [], restoreUrl: "#", code: null, pct: 0, unsubscribeUrl: "#" }).html).not.toContain("промокод")
  })
})
