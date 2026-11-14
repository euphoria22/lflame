import { subtypeOf } from "../subtypes"

describe("подразделы по названию", () => {
  const s = (c: string, t: string) => subtypeOf(c, t)?.slug ?? null
  it("футболки и лонгсливы, худи и свитшоты", () => {
    expect(s("futbolki-i-longslivy", "Футболка Calvin Klein Monologo")).toBe("futbolki")
    expect(s("futbolki-i-longslivy", "Лонгслив Yeezy Gap Dove")).toBe("longslivy")
    expect(s("futbolki-i-longslivy", "Майка MISBHV Muscle Tank")).toBe("futbolki")
    expect(s("hudi-i-svitshoty", "Худи на молнии C.P. Company")).toBe("hudi")
    expect(s("hudi-i-svitshoty", "Свитшот Carhartt WIP")).toBe("svitshoty")
  })
  it("опечатки: латинская C в «Cвитшот»", () => {
    expect(s("hudi-i-svitshoty", "Cвитшот Diesel S-ROB-MEGOVAL Black")).toBe("svitshoty")
  })
  it("куртки: утеплённые отдельно", () => {
    expect(s("kurtki", "Пуховик C.P. Company Micro-M")).toBe("puhoviki")
    expect(s("kurtki", "Утепленная куртка Calvin Klein Puffer")).toBe("puhoviki")
    expect(s("kurtki", "Утеплённый Бомбер Calvin Klein")).toBe("puhoviki")
    expect(s("kurtki", "Куртка Calvin Klein Softshell")).toBe("kurtki-i-bombery")
    expect(s("kurtki", "Джинсовая куртка Carhartt WIP")).toBe("kurtki-i-bombery")
  })
  it("шапки и кепки, поло и рубашки", () => {
    expect(s("golovnye-ubory", "Бейсболка Polo Ralph Lauren")).toBe("kepki")
    expect(s("golovnye-ubory", "Балаклава Stone Island")).toBe("shapki")
    expect(s("rubashki-i-polo", "Поло Lacoste")).toBe("polo")
    expect(s("rubashki-i-polo", "Рубашка Carhartt WIP")).toBe("rubashki")
  })
  it("раздел без подразделов и незнакомое название", () => {
    expect(s("dzhinsy", "Джинсы Diesel")).toBeNull()
    expect(s("kurtki", "Что-то новое")).toBeNull()
  })
})
