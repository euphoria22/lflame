import { checkLayout, CheckItem } from "../checks"

const room = { width: 10, length: 8, openings: [{ kind: "door", wall: "bottom", offset: 4, width: 1.2 }] }
const eq = (id: string, x: number, y: number, extra: Partial<CheckItem> = {}): CheckItem => ({ id, type: "rack_base", x, y, w: 1.4, d: 0.45, h: 1.65, rot: 0, ...extra })

describe("проверка расстановки", () => {
  it("пересечение и выход за стену", () => {
    const w = checkLayout([eq("a", 3, 3), eq("b", 3.5, 3.1), eq("c", 9.6, 3)], room)
    expect(w.some((x) => x.ids.includes("a") && x.ids.includes("b") && x.level === "error")).toBe(true)
    expect(w.some((x) => x.ids.includes("c") && /за стену/.test(x.text))).toBe(true)
  })
  it("узкий проход", () => {
    const w = checkLayout([eq("a", 3, 3), eq("b", 3, 3.95)], room)
    expect(w.some((x) => /Узкий проход 50 см/.test(x.text))).toBe(true)
  })
  it("перекрытый вход и высокое у входа", () => {
    const w = checkLayout([eq("a", 4.6, 7.2), eq("b", 2.5, 6.0)], room)
    expect(w.some((x) => x.ids.includes("a") && /перекрывает вход/.test(x.text))).toBe(true)
    expect(w.some((x) => x.ids.includes("b") && /закрывает обзор/.test(x.text))).toBe(true)
  })
  it("полки на стене и треки проходу не мешают", () => {
    expect(checkLayout([eq("a", 3, 0.6), eq("s", 3, 0.15, { type: "wall_shelf", w: 0.6, d: 0.3 })], room)).toEqual([])
  })
})
