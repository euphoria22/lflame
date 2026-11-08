import { matchBrand, seedMatchers } from "../brands"
import { colorFromName, detectColor } from "../colors"
import { detectGender } from "../gender"
import { normalizeSize, sortSizes } from "../sizes"
import { fixLatinLookalikes, slugify } from "../translit"

const brands = seedMatchers()
const brandOf = (name: string) => matchBrand(name, brands)?.brand.name ?? null

describe("slugify", () => {
  it("транслитерирует русские названия", () => {
    expect(slugify("Худи Tommy Jeans Tommy Logo Silver Grey")).toBe("hudi-tommy-jeans-tommy-logo-silver-grey")
    expect(slugify("Cумки и рюкзаки")).toBe("sumki-i-ryukzaki")
    expect(slugify("Свитшот")).toBe("svitshot")
  })
  it("убирает точки, апострофы и звёздочки", () => {
    expect(slugify("C.P. Company")).toBe("cp-company")
    expect(slugify("Levi's")).toBe("levis")
    expect(slugify("A-COLD-WALL*")).toBe("a-cold-wall")
    expect(slugify("Palace McDonald's")).toBe("palace-mcdonalds")
  })
  it("обрезает по границе слова", () => {
    const s = slugify("Шорты Cactus Jack Travis Scott x Mitchell & Ness University Of Oklahoma Basketball Brown", 60)
    expect(s.length).toBeLessThanOrEqual(60)
    expect(s.endsWith("-")).toBe(false)
  })
})

describe("fixLatinLookalikes", () => {
  it("исправляет кириллицу в латинских словах и наоборот", () => {
    expect(fixLatinLookalikes("Рюкзак Сalvin Klein")).toBe("Рюкзак Calvin Klein")
    expect(fixLatinLookalikes("Cумки")).toBe("Сумки")
  })
})

describe("normalizeSize", () => {
  it.each([
    ["One size", "One Size"],
    ["ONE SIZE", "One Size"],
    ["М", "M"],
    ["xl", "XL"],
    ["32х32", "32x32"],
    ["32 x 32", "32x32"],
    ["25xRL", "25xRL"],
    ["42 EUR", "42 EU"],
    ["42 EU", "42 EU"],
    ["42,5 EUR", "42.5 EU"],
    ["36.5 EUR", "36.5 EU"],
    ["41 1/3 EUR", "41 1/3 EU"],
    ["S/M", "S/M"],
    ["M-L", "M/L"],
    ["48 (M)", "48 (M)"],
    ["52 (L-XL)", "52 (L/XL)"],
    ["30", "30"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeSize(raw)).toBe(expected)
  })

  it("сортирует размеры", () => {
    expect(sortSizes(["XL", "S", "One Size", "M", "XXS", "L"])).toEqual(["XXS", "S", "M", "L", "XL", "One Size"])
    expect(sortSizes(["44 EU", "42.5 EU", "43 EU"])).toEqual(["42.5 EU", "43 EU", "44 EU"])
    expect(sortSizes(["32x32", "30x32", "32x30"])).toEqual(["30x32", "32x30", "32x32"])
  })
})

describe("brands", () => {
  it.each([
    ["Худи Calvin Klein Monogram Logo Fleece Black", "Calvin Klein"],
    ["Джинсы Calvin Klein Jeans 90s Straight", "Calvin Klein Jeans"],
    ["Рюкзак Сalvin Klein All Day Campus Naval Academy", "Calvin Klein"],
    ["Пуховик C.P. Company Chrome-R Goggle Down Jacket Black", "C.P. Company"],
    ["Футболка C.P Company Logo White", "C.P. Company"],
    ["Худи Yeezy x Gap Perfect Hoodie Brown", "Yeezy Gap"],
    ["Шорты Cactus Jack Travis Scott x Mitchell & Ness Penn State", "Travis Scott"],
    ["Сумка Travis Scott \"I Can See The Future\" Beige", "Travis Scott"],
    ["Сумка Lauren Ralph Lauren Evan 27 Noir", "Lauren Ralph Lauren"],
    ["Кеды Polo Ralph Lauren Court VLC White / Navy & Green", "Polo Ralph Lauren"],
    ["Худи F*cking Awesome Pixel Eye Grey", "Fucking Awesome"],
    ["Футболка Market Dancing Trio Bear Green", "Market"],
    ["Свитер A-COLD-WALL* Drop Shoulder Transparency Black", "A-COLD-WALL*"],
    ["Кеды Masion Margeila New Evolution low white/off white", "Maison Margiela"],
    ["Пуховик The North Face Black & Khaki 1996 Retro Nuptse", "The North Face"],
    ["Кроссовки On Running Cloud 6 White", "On Running"],
    ["Сумка Ugg X Telfar Large Suede Baby Pink", "UGG"],
    ["Ботинки Dr.Martens 1460 Black", "Dr. Martens"],
    ["Футболка без бренда Black", null],
  ])("%s -> %s", (name, expected) => {
    expect(brandOf(name)).toBe(expected)
  })
})

describe("colors", () => {
  it.each([
    ["Свитер Tommy Jeans Intarsia Flag Logo Black Heather", "black"],
    ["Сумка Calvin Klein Elemental Messenger Bag Black Beauty", "black"],
    ["Свитшот Chinatown Market Grateful Dead Deadtown Ash", "grey"],
    ["Худи Calvin Klein Grey Heather", "grey"],
    ["Футболка Tommy Hilfiger Embroidered TH Logo Navy", "blue"],
    ["Кроссовки On Running Cloud 6 Black / White", "black"],
    ["Футболка C.P. Company 30/1 Jersey Logo Dark Burgundy (B)", "burgundy"],
    ["Кеды Maison Margiela Tabi Canvas High Top White", "white"],
    ["Футболка Market Fit Check Bear Butter Cream", "beige"],
    ["Сумка Ugg X Telfar Large Suede", null],
  ])("%s -> %s", (name, expected) => {
    expect(colorFromName(name)).toBe(expected)
  })

  it("поле МС важнее названия", () => {
    expect(detectColor("Футболка Logo Black", "Белый")).toBe("white")
    expect(detectColor("Футболка Logo Black", "")).toBe("black")
  })
})

describe("gender", () => {
  it("поле «Для кого», затем название, по умолчанию мужское", () => {
    expect(detectGender("Худи", "Женское")).toBe("women")
    expect(detectGender("Худи", "Унисекс")).toBe("unisex")
    expect(detectGender("Женские кроссовки New Balance", null)).toBe("women")
    expect(detectGender("Мужские кроссовки New Balance", null)).toBe("men")
    expect(detectGender("Худи Calvin Klein", null)).toBe("men")
  })
})
