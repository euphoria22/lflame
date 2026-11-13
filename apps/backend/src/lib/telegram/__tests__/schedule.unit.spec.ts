import { DEFAULT_SCHEDULE as S, dueSlot, nextSlots, validateSchedule } from "../schedule"

const omsk = (d: Date) => d.toLocaleString("ru-RU", { timeZone: "Asia/Omsk", day: "2-digit", hour: "2-digit", minute: "2-digit" })

describe("расписание постов (Омск, 12:00–21:00, раз в 30 минут)", () => {
  it("ближайшие слоты: утром — с 12:00 сегодня, вечером — с 12:00 завтра", () => {
    expect(nextSlots(S, new Date("2026-11-13T05:10:00Z"), 3).map(omsk)).toEqual(["13, 12:00", "13, 12:30", "13, 13:00"])
    expect(nextSlots(S, new Date("2026-11-13T15:05:00Z"), 2).map(omsk)).toEqual(["14, 12:00", "14, 12:30"])
    expect(nextSlots(S, new Date("2026-11-13T14:50:00Z"), 2).map(omsk)).toEqual(["13, 21:00", "14, 12:00"])
  })

  it("в день 19 слотов: 12:00 … 21:00 включительно", () => {
    const day = nextSlots(S, new Date("2026-11-13T05:00:00Z"), 40).filter((d) => omsk(d).startsWith("13"))
    expect(day).toHaveLength(19)
  })

  it("пора выкладывать — только в свой слот и один раз", () => {
    expect(dueSlot(S, new Date("2026-11-13T06:31:00Z"), null)?.toISOString()).toBe("2026-11-13T06:30:00.000Z")
    expect(dueSlot(S, new Date("2026-11-13T06:31:00Z"), "2026-11-13T06:30:20Z")).toBeNull()
    expect(dueSlot(S, new Date("2026-11-13T04:00:00Z"), null)).toBeNull()
    // Сервер лежал — пропущенные слоты пачкой не выкладываем
    expect(dueSlot(S, new Date("2026-11-13T06:45:00Z"), null)).toBeNull()
    expect(dueSlot({ ...S, enabled: false }, new Date("2026-11-13T06:31:00Z"), null)).toBeNull()
  })

  it("проверка настроек", () => {
    expect(validateSchedule({ start: "21:00", end: "12:00" }).error).toBeTruthy()
    expect(validateSchedule({ every: 1 }).error).toBeTruthy()
    expect(validateSchedule({ start: "9:00" }).error).toBeTruthy()
    expect(validateSchedule({ start: "10:00", every: 60, auto: true }).value).toMatchObject({ start: "10:00", end: "21:00", every: 60, auto: true, enabled: true })
  })
})
