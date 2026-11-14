import { buildVkText } from "../post"
import { vkPostLink } from "../client"

const p = {
  handle: "puhovik-ck", title: "Пуховик Calvin Klein Nylon Puffer Black", price: 17990, compare_at: 45990, promo: null,
  preorder: false, outlet: false, description: "<p>Тёплый пуховик</p>", specs: "Состав: 100% нейлон",
  sizes: [{ size: "M", in_stock: true }, { size: "L", in_stock: false }], images: [],
}
const opts = { site: "https://laflamme.ru", contact: "@laflammehelp" }

describe("пост во ВКонтакте", () => {
  it("без разметки: название, цена со старой зачёркнутой, размеры, описание, ссылка", () => {
    const t = buildVkText(p, opts)
    expect(t).not.toMatch(/<[^>]+>/)
    expect(t.split("\n")[0]).toBe("Пуховик Calvin Klein Nylon Puffer Black")
    expect(t).toContain("17 990 ₽")
    expect(t).toContain("̶")
    expect(t).not.toContain("SALE")
    expect(t).toContain("Размеры в наличии: M")
    expect(t).toContain("Тёплый пуховик")
    expect(t).toContain("Состав: 100% нейлон")
    expect(t).toContain("Купить на сайте: https://laflamme.ru/product/puhovik-ck")
    expect(t).toContain("Оформить заказ: @laflammehelp")
  })
  it("акция — SALE, предзаказ — без SALE", () => {
    const promo = { price: 13490, label: "11.11", pct: 25 }
    expect(buildVkText({ ...p, promo }, opts)).toContain("SALE 🔥")
    const pre = buildVkText({ ...p, promo, preorder: true, preorder_date: null }, opts)
    expect(pre).not.toContain("SALE")
    expect(pre).toContain("Предзаказ")
  })
  it("длинное описание обрезается", () => {
    const t = buildVkText({ ...p, description: "Очень длинный текст. ".repeat(500) }, opts)
    expect(t.length).toBeLessThanOrEqual(2000)
    expect(t).toContain("Купить на сайте")
  })
  it("ссылка на пост", () => {
    process.env.VK_GROUP_ID = "-123456"
    expect(vkPostLink(42)).toBe("https://vk.com/wall-123456_42")
    process.env.VK_GROUP_ID = "club777"
    expect(vkPostLink(1)).toBe("https://vk.com/wall-777_1")
  })
})
