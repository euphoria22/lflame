import { buildCaption, CAPTION_LIMIT, inSeason, postLink, postPhotos, postState, PostProduct, RecItem, recommend, tgMetaOf, visibleLength } from "../post"

const product: PostProduct = {
  handle: "hudi-calvin-klein-terry",
  title: "Худи на молнии Calvin Klein Terry Varsity Logo Nurture Navy",
  price: 6792,
  compare_at: 24990,
  preorder: false,
  outlet: false,
  description: "Худи из мягкого terry-трикотажа с расслабленной посадкой.",
  specs: "Состав: 86% хлопок, 14% полиэстер\nКрой: Relaxed Fit",
  sizes: [{ size: "M", in_stock: false }, { size: "L", in_stock: true }, { size: "XL", in_stock: true }],
  images: ["https://s3/a.jpg", "https://s3/b.jpg"],
}
const opts = { site: "https://laflamme.ru", contact: "@laflammehelp" }

describe("подпись поста", () => {
  it("название-ссылка, цена со скидкой, размеры, описание, контакт", () => {
    const c = buildCaption(product, opts)
    expect(c).toContain('<a href="https://laflamme.ru/product/hudi-calvin-klein-terry">Худи на молнии Calvin Klein')
    expect(c).toContain("<b>6 792 ₽</b> <s>24 990 ₽</s> — SALE 🔥")
    expect(c).toContain("Размеры в наличии: L, XL")
    expect(c).toContain("<blockquote expandable>Худи из мягкого")
    expect(c).toContain("Состав: 86% хлопок, 14% полиэстер\nКрой: Relaxed Fit</blockquote>")
    expect(c).toContain("или @laflammehelp")
  })

  it("без скидки и без размеров — «Нет в наличии»", () => {
    const c = buildCaption({ ...product, compare_at: null, sizes: [{ size: "L", in_stock: false }] }, opts)
    expect(c).toContain("<b>6 792 ₽</b>\n")
    expect(c).not.toContain("SALE")
    expect(c).toContain("Нет в наличии")
  })

  it("длинное описание обрезается под лимит Telegram", () => {
    const c = buildCaption({ ...product, description: "Очень длинное описание. ".repeat(200) }, opts)
    expect(visibleLength(c)).toBeLessThanOrEqual(CAPTION_LIMIT)
    expect(c).toContain("…</blockquote>")
  })

  it("акция 11.11: итоговая цена, зачёркнутая старая, строка про доп. скидку", () => {
    const c = buildCaption({ ...product, price: 9990, compare_at: 27990, promo: { price: 7493, label: "11.11", pct: 25 } }, opts)
    expect(c).toContain("<b>7 493 ₽</b> <s>27 990 ₽</s> — SALE 🔥")
    expect(c).toContain("Дополнительная скидка −25% по акции «11.11» уже в цене")
    const noOld = buildCaption({ ...product, price: 10000, compare_at: null, promo: { price: 8500, label: "11.11", pct: 15 } }, opts)
    expect(noOld).toContain("<b>8 500 ₽</b> <s>10 000 ₽</s> — SALE 🔥")
    expect(postState({ ...product, promo: { price: 8500, label: "11.11", pct: 15 } })).not.toBe(postState(product))
  })

  it("предзаказ: дата поступления и пояснение", () => {
    const c = buildCaption({ ...product, preorder: true, preorder_date: "2099-11-25" }, opts)
    expect(c).toContain("🕓 <b>Предзаказ</b> — ожидаем 25 ноября")
    expect(c).toContain("свяжемся, когда товар поступит")
    expect(c).toContain("Размеры для предзаказа: L, XL")
    expect(buildCaption({ ...product, preorder: true, preorder_date: null }, opts)).toContain("— товар уже едет к нам")
    expect(postState({ ...product, preorder: true, preorder_date: "2099-11-25" })).not.toBe(postState({ ...product, preorder: true, preorder_date: "2099-12-01" }))
  })

  it("спецсимволы экранируются", () => {
    expect(buildCaption({ ...product, title: "A & B <x>" }, opts)).toContain("A &amp; B &lt;x&gt;")
  })

  it("строка без подписи с процентами — «Состав»", () => {
    expect(buildCaption({ ...product, description: null, specs: "100% хлопок" }, opts)).toContain("Состав: 100% хлопок")
  })

  it("состояние меняется, когда продали размер или изменилась цена", () => {
    const a = postState(product)
    expect(postState({ ...product })).toBe(a)
    expect(postState({ ...product, sizes: [{ size: "L", in_stock: true }] })).not.toBe(a)
    expect(postState({ ...product, price: 5000 })).not.toBe(a)
  })

  it("фото через сжатие сайта, не больше 10", () => {
    const urls = postPhotos(Array.from({ length: 12 }, (_, i) => `https://s3/${i}.jpg`), "https://laflamme.ru")
    expect(urls).toHaveLength(10)
    expect(urls[0]).toBe("https://laflamme.ru/_next/image?url=https%3A%2F%2Fs3%2F0.jpg&w=1080&q=85")
  })

  it("ссылка на пост публичного канала", () => {
    expect(postLink("@laflammeru", 42)).toBe("https://t.me/laflammeru/42")
    expect(postLink("-100123", 42)).toBeNull()
  })

  it("история постов из metadata", () => {
    expect(tgMetaOf({ tg: { posts: [{ id: 1, at: "2026-11-01T00:00:00Z" }, { bad: 1 }], state: "x" } })).toEqual({ posts: [{ id: 1, at: "2026-11-01T00:00:00Z" }], state: "x" })
    expect(tgMetaOf(null)).toEqual({ posts: [], state: undefined })
  })
})

describe("рекомендации", () => {
  const now = new Date("2026-11-13T12:00:00Z")
  const base: RecItem & { category_handle: string | null } = {
    id: "p1", handle: "h", title: "T", thumbnail: null, brand: "Calvin Klein", category: "Куртки", category_handle: "kurtki",
    price: 10000, compare_at: null, promo: null, in_stock: true, preorder: false, sizes_in_stock: 4, sizes_total: 5, images: 4,
    has_description: true, sales: 0, is_new: false, created_at: "2026-01-01T00:00:00Z", posts: [],
  }
  const ctx = { now, recentBrands: new Set<string>() }

  it("не выкладывали + по сезону — выше, чем давно выложенный", () => {
    const never = recommend(base, ctx)!
    const old = recommend({ ...base, posts: [{ id: 1, at: "2026-10-01T00:00:00Z" }] }, ctx)!
    expect(never.reasons).toEqual(expect.arrayContaining(["ещё не выкладывали", "по сезону"]))
    expect(never.score).toBeGreaterThan(old.score)
  })

  it("не предлагаем: нет в наличии, мало фото, выкладывали на этой неделе", () => {
    expect(recommend({ ...base, in_stock: false }, ctx)).toBeNull()
    expect(recommend({ ...base, images: 1 }, ctx)).toBeNull()
    expect(recommend({ ...base, posts: [{ id: 1, at: "2026-11-10T00:00:00Z" }] }, ctx)).toBeNull()
  })

  it("скидка, новинка, последние размеры, продажи — причины и плюс к оценке", () => {
    const r = recommend({ ...base, compare_at: 20000, is_new: true, sizes_in_stock: 1, sales: 3 }, ctx)!
    expect(r.reasons).toEqual(expect.arrayContaining(["новинка", "скидка 50%", "остались последние размеры", "продаж за 60 дней: 3"]))
    expect(r.score).toBeGreaterThan(recommend(base, ctx)!.score)
  })

  it("акция считается в скидке и даёт причину", () => {
    const r = recommend({ ...base, compare_at: 30000, promo: { price: 7500, label: "11.11", pct: 25 } }, ctx)!
    expect(r.reasons).toEqual(expect.arrayContaining(["скидка 75%", "акция «11.11» −25%"]))
  })

  it("бренд был в последние дни — ниже", () => {
    const r = recommend(base, { now, recentBrands: new Set(["Calvin Klein"]) })!
    expect(r.score).toBeLessThan(recommend(base, ctx)!.score)
  })

  it("сезон: зимой куртки, летом шорты", () => {
    expect(inSeason("kurtki", 12)).toBe(true)
    expect(inSeason("shorty", 12)).toBe(false)
    expect(inSeason("shorty", 7)).toBe(true)
  })
})

