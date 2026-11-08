import { seedMatchers } from "../../catalog/brands"
import { mapProduct } from "../map-product"
import { MsProduct, MsVariant } from "../types"

const prices = (sale: number, old = 0) => [
  { value: sale * 100, priceType: { name: "Цена продажи" } },
  { value: old * 100, priceType: { name: "Старая цена" } },
]

const product: MsProduct = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Сумка Stone Island 9200014 Coated Nylon  Bag",
  archived: false,
  updated: "2026-11-01 10:00:00.000",
  productFolder: { meta: { href: "https://api.moysklad.ru/api/remap/1.2/entity/productfolder/22222222-2222-2222-2222-222222222222" } },
  attributes: [{ id: "a", name: "Ссылка на товар", type: "link", value: "https://laflamme.ru/katalog/tproduct/1-2-sumka" }],
  salePrices: prices(17590, 21990),
  variantsCount: 2,
}

const variant = (id: string, size: string, sale = 0, old = 0): MsVariant => ({
  id,
  name: `${product.name} (${size})`,
  code: `code-${id}`,
  archived: false,
  updated: "2026-11-01 10:00:00.000",
  characteristics: [{ name: "Размер", value: size }],
  salePrices: prices(sale, old),
  barcodes: [{ ean13: `20000000${id}` }],
  product: { meta: { href: `https://api.moysklad.ru/api/remap/1.2/entity/product/${product.id}` } },
})

describe("mapProduct", () => {
  const mapped = mapProduct(
    product,
    [variant("v2", "L", 17590, 21990), variant("v1", "М", 17590, 21990), variant("v3", "XL", 0, 0)],
    new Map([["v1", 2], ["v2", 0], ["v3", 1]]),
    seedMatchers()
  )

  it("определяет бренд и не путает Stone Island с цветом", () => {
    expect(mapped.brand?.name).toBe("Stone Island")
    expect(mapped.color).toBeNull()
    expect(mapped.problems).toContain("Цвет не определён")
  })

  it("нормализует и сортирует размеры", () => {
    expect(mapped.sizes).toEqual(["M", "L", "XL"])
    expect(mapped.variants.map((v) => v.size)).toEqual(["M", "L", "XL"])
  })

  it("переводит цены из копеек и берёт цену товара, если у модификации её нет", () => {
    const xl = mapped.variants.find((v) => v.size === "XL")!
    expect(xl.price).toBe(17590)
    expect(xl.compareAtPrice).toBe(21990)
  })

  it("считает остатки", () => {
    expect(mapped.totalStock).toBe(3)
  })

  it("берёт группу, ссылку на старый сайт, пол по умолчанию и slug", () => {
    expect(mapped.folderId).toBe("22222222-2222-2222-2222-222222222222")
    expect(mapped.oldSiteUrl).toContain("laflamme.ru")
    expect(mapped.gender).toBe("men")
    expect(mapped.handleBase).toBe("sumka-stone-island-9200014-coated-nylon-bag")
    expect(mapped.title).toBe("Сумка Stone Island 9200014 Coated Nylon Bag")
  })

  it("помечает повтор размера после нормализации", () => {
    const dup = mapProduct(product, [variant("a", "M", 100), variant("b", "М", 100)], new Map(), seedMatchers())
    expect(dup.variants).toHaveLength(2)
    expect(dup.problems.some((p) => p.startsWith("Повтор размера"))).toBe(true)
  })

  it("товар без модификаций продаётся как One Size", () => {
    const single = mapProduct({ ...product, variantsCount: 0 }, [], new Map([[product.id, 1]]), seedMatchers())
    expect(single.variants).toHaveLength(1)
    expect(single.variants[0].size).toBe("One Size")
    expect(single.totalStock).toBe(1)
  })
})
