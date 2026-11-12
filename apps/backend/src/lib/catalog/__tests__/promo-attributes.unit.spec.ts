import { wantedTags } from "../promo-attributes"

describe("теги для акций", () => {
  it("пол, цвет и пометки", () => {
    expect(wantedTags({ gender: "women", color_name: "Чёрный", outlet: true, is_new: true })).toEqual(["Пол: Женское", "Цвет: Чёрный", "Метка: Outlet", "Метка: Новинка"])
    expect(wantedTags({})).toEqual([])
  })
})
