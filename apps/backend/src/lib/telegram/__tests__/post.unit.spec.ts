import { buildCaption, CAPTION_LIMIT, categoryDemand, inSeason, mixOrder, postImages, postLink, postPhotos, postState, PostProduct, RecItem, recommend, tgMetaOf, visibleLength } from "../post"

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
    expect(c).toContain("<b>6 792 ₽</b> <b><s>24 990 ₽</s></b>\n")
    // Постоянная скидка без акции — без SALE
    expect(c).not.toContain("SALE")
    expect(c).toContain("Размеры в наличии: L, XL")
    expect(c).toContain("<blockquote expandable>Худи из мягкого")
    expect(c).toContain("Состав: 86% хлопок, 14% полиэстер\nКрой: Relaxed Fit</blockquote>")
    expect(c).toContain("Оформить заказ: @laflammehelp")
    expect(c).not.toContain("на сайте</a>")
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
    expect(c).toContain("<b>7 493 ₽</b> <b><s>27 990 ₽</s></b> — <b>SALE</b> 🔥")
    expect(c).toContain("Дополнительная скидка −25% по акции «11.11» уже в цене")
    const noOld = buildCaption({ ...product, price: 10000, compare_at: null, promo: { price: 8500, label: "11.11", pct: 15 } }, opts)
    expect(noOld).toContain("<b>8 500 ₽</b> <b><s>10 000 ₽</s></b> — <b>SALE</b> 🔥")
    expect(postState({ ...product, promo: { price: 8500, label: "11.11", pct: 15 } })).not.toBe(postState(product))
  })

  it("предзаказ: дата поступления и пояснение", () => {
    const c = buildCaption({ ...product, preorder: true, preorder_date: "2099-11-25" }, opts)
    expect(c).toContain("🕓 <b>Предзаказ</b> — ориентировочная дата поступления до 25 ноября")
    expect(c).not.toContain("SALE")
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
    has_description: true, sales: 0, stock_units: 3, model_units: 3, is_new: false, created_at: "2026-01-01T00:00:00Z", posts: [],
  }
  const ctx = { now, recentBrands: new Set<string>() }

  const sc = (score: number, over: Partial<{ N: number; Z: number; I: number }> = {}, multipliers: { code: string; label: string; value: number }[] = []) =>
    ({ score, components: { N: 0, S: 0, I: 0, R: 1, Z: 0.5, M: 0.5, ...over }, multipliers })
  const full = { ...ctx, maxScore: 0.8 }

  it("не выкладывали — выше, чем давно выложенный", () => {
    const never = recommend(base, ctx)!
    const old = recommend({ ...base, posts: [{ id: 1, at: "2026-10-01T00:00:00Z" }] }, ctx)!
    expect(never.reasons).toContain("ещё не выкладывали")
    expect(never.score).toBeGreaterThan(old.score)
  })

  it("не предлагаем: нет в наличии, нет фото, выкладывали на этой неделе; число фото не влияет", () => {
    expect(recommend({ ...base, in_stock: false }, ctx)).toBeNull()
    expect(recommend({ ...base, images: 0 }, ctx)).toBeNull()
    expect(recommend({ ...base, images: 1 }, ctx)!.score).toBe(recommend({ ...base, images: 8 }, ctx)!.score)
    expect(recommend({ ...base, posts: [{ id: 1, at: "2026-11-10T00:00:00Z" }] }, ctx)).toBeNull()
  })

  it("основа — балл каталога: выше балл — выше рекомендация; причины из компонентов и ручных правил", () => {
    const hi = recommend({ ...base, base: sc(0.8, { N: 0.7, Z: 0.9 }, [{ code: "manual", label: "буст бренда ×1.3", value: 1.3 }]) }, full)!
    const lo = recommend({ ...base, base: sc(0.2) }, full)!
    expect(hi.score - lo.score).toBeGreaterThan(30)
    expect(hi.reasons).toEqual(expect.arrayContaining(["балл каталога 0.80", "новинка", "по сезону", "буст бренда ×1.3 ×1.3"]))
    expect(lo.reasons).not.toContain("по сезону")
  })

  it("веса из настроек: балл каталога можно выключить, остаток — усилить", () => {
    const tg = { score: 0, stock: 100, demand: 0, never_posted: 0, old_post: 0, promo: 0, recent_brand: 0, cooldown_days: 0, brand_gap: 3, category_gap: 2, model_gap: 8 }
    const a = recommend({ ...base, base: sc(0.8), stock_units: 40, model_units: 40 }, { ...full, tg })!
    const b = recommend({ ...base, base: sc(0.1), stock_units: 40, model_units: 40, posts: [{ id: 1, at: "2026-11-12T00:00:00Z" }] }, { ...full, tg })!
    expect(a.score).toBe(100)
    expect(b.score).toBe(100)
  })

  it("акция даёт очки и причину, скидка — причину", () => {
    const r = recommend({ ...base, compare_at: 30000, promo: { price: 7500, label: "11.11", pct: 25 } }, ctx)!
    expect(r.reasons).toEqual(expect.arrayContaining(["скидка 75%", "акция «11.11» −25%"]))
    expect(r.score).toBeGreaterThan(recommend(base, ctx)!.score)
  })

  it("бренд был в последние дни — ниже", () => {
    const r = recommend(base, { now, recentBrands: new Set(["Calvin Klein"]) })!
    expect(r.score).toBeLessThan(recommend(base, ctx)!.score)
  })

  it("большой остаток модели — выше", () => {
    const big = recommend({ ...base, stock_units: 12, model_units: 40 }, ctx)!
    expect(big.reasons).toContain("на складе 12 шт., всего модели 40 шт.")
    expect(big.score).toBeGreaterThan(recommend(base, ctx)!.score + 10)
  })

  it("раздел хорошо продаётся — выше даже не в сезон", () => {
    const demand = categoryDemand([
      { category_handle: "bele", sales: 120 }, { category_handle: "futbolki-i-longslivy", sales: 60 }, { category_handle: "kurtki", sales: 5 },
    ])
    const c = { ...ctx, demand }
    const underwear = recommend({ ...base, category: "Нижнее бельё", category_handle: "bele" }, c)!
    expect(underwear.reasons).toContain("раздел продаётся: 120 шт. за 30 дн.")
    expect(underwear.score).toBeGreaterThan(recommend(base, c)!.score)
  })

  it("порядок вперемешку: бренд и раздел не идут подряд, учитываются последние посты", () => {
    const it = (id: string, brand: string, category: string, score: number) => ({ id, brand, category, model: id, score })
    const sorted = [it("a", "CK", "Свитеры", 90), it("b", "CK", "Свитеры", 89), it("c", "CK", "Куртки", 88), it("d", "TH", "Свитеры", 70), it("e", "Nike", "Бельё", 60)]
    const ids = mixOrder(sorted).map((x) => x.id)
    expect(ids[0]).toBe("a")
    expect(ids[1]).not.toBe("b")
    expect(ids[1]).not.toBe("c")
    // Последний пост — CK: первым идёт другой бренд
    expect(mixOrder(sorted, [{ brand: "CK", category: "Свитеры", model: "x" }])[0].brand).not.toBe("CK")
    // Одна модель в разных цветах не рядом
    const colors = [{ ...it("r", "A", "X", 9), model: "m" }, { ...it("g", "A", "X", 8), model: "m" }, it("z", "B", "Y", 1)]
    expect(mixOrder(colors).map((x) => x.id)).toEqual(["r", "z", "g"])
  })

  it("сезон: зимой куртки, летом шорты", () => {
    expect(inSeason("kurtki", 12)).toBe(true)
    expect(inSeason("shorty", 12)).toBe(false)
    expect(inSeason("shorty", 7)).toBe(true)
  })
})


describe("фото для поста", () => {
  const imgs = ["a.jpg", "b.jpg", "c.jpg", "d.jpg"]
  it("выбранные вручную — по порядку; удалённые с товара пропускаются; не выбрано — все", () => {
    expect(postImages({ social_photos: ["c.jpg", "a.jpg"] }, imgs)).toEqual(["c.jpg", "a.jpg"])
    expect(postImages({ social_photos: ["x.jpg", "b.jpg"] }, imgs)).toEqual(["b.jpg"])
    expect(postImages({ social_photos: ["x.jpg"] }, imgs)).toEqual(imgs)
    expect(postImages(null, imgs)).toEqual(imgs)
  })
})
