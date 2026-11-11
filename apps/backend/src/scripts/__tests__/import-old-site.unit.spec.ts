import { parseOldPage, titleKey } from "../import-old-site"

const RAW = `<h1 class="card-h1">Куртка Calvin Klein Harrington Jacket
</h1>
<img loading="lazy" src="/x.jpg" data-fancybox="gallery" data-src="/upload/iblock/7ae/a.jpg">
<img loading="lazy" src="/y.jpg" data-fancybox="gallery" data-src="/upload/iblock/eca/b.jpg">
<spoiler-component open="true" id="FEATURETEXT">
<div class="pt-5">Состав: 100% полиэстер<br> <br> Крой: Classic&nbsp;Fit</div> </spoiler-component>`

describe("перенос со старого сайта: разбор страницы", () => {
  it("исходный код страницы (как отдаёт сервер)", () => {
    const p = parseOldPage("https://laflamme.ru/x", RAW)
    expect(p.title).toBe("Куртка Calvin Klein Harrington Jacket")
    expect(p.description).toBe("Состав: 100% полиэстер\n\nКрой: Classic Fit")
    expect(p.images).toHaveLength(2)
  })
  it("страница, сохранённая браузером (служебная обёртка <template>)", () => {
    const saved = RAW.replace('id="FEATURETEXT">', 'id="FEATURETEXT"><template shadowrootmode="open"><style>.x{}</style><div class="container"><slot></slot></div></template>')
    expect(parseOldPage("https://laflamme.ru/x", saved).description).toBe("Состав: 100% полиэстер\n\nКрой: Classic Fit")
  })
  it("названия сравниваются без регистра, знаков и ё", () => {
    expect(titleKey("Худи Stüssy «Logo» — Чёрный")).toBe(titleKey("худи stüssy logo черный"))
  })
})
