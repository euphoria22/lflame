import { modelKeys } from "../model-key"

const ck = { handle: "calvin-klein", name: "Calvin Klein" }
const tees = { handle: "futbolki" }
const item = (id: string, title: string, brand = ck, category = tees) => ({ id, title, brand, category })

describe("модель без цвета", () => {
  it("цвета одной модели — одна модель, другие модели — отдельно", () => {
    const k = modelKeys([
      item("1", "Футболка Calvin Klein Monologo 90s Fit Tofu"),
      item("2", "Футболка Calvin Klein Monologo 90s Fit Dark Denim"),
      item("3", "Футболка Calvin Klein Monologo 90s Fit Black"),
      item("4", "Футболка Calvin Klein Archive Logo Relaxed Black Beauty"),
      item("5", "Футболка Calvin Klein Acid Wash Monologo Black"),
    ])
    expect(k.get("1")).toBe(k.get("2"))
    expect(k.get("1")).toBe(k.get("3"))
    expect(k.get("4")).not.toBe(k.get("1"))
    expect(k.get("5")).not.toBe(k.get("1"))
    expect(k.get("4")).not.toBe(k.get("5"))
  })
  it("только бренд общий — не модель", () => {
    const yg = { handle: "yeezy-gap", name: "Yeezy Gap" }
    const k = modelKeys([item("a", "Худи Yeezy Gap Unreleased Fleece Black", yg), item("b", "Худи Yeezy Gap Round Jacket Red", yg)])
    expect(k.get("a")).not.toBe(k.get("b"))
  })
})
