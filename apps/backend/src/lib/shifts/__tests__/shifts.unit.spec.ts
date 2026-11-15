jest.mock("@medusajs/framework", () => ({ container: {} }))
import { dayCrew, omskNow, reminderText, scheduleText, Shifts, statusOf, todayText } from "../shifts"

const weekdays = Array.from({ length: 30 }, (_, i) => ([6, 0].includes(new Date(Date.UTC(2026, 10, i + 1)).getUTCDay()) ? "o" : "w")).join("")
const s: Shifts = {
  people: [{ id: "ivan", name: "Иван", tg: "ivan_tg" }, { id: "maxim", name: "Максим" }, { id: "liza", name: "Лиза" }],
  months: { "2026-11": { ivan: "wowwoowwowwoowwowwoowwow???ww?", maxim: weekdays, liza: weekdays } },
  chat_id: "-100", chat_title: "", remind_enabled: true, remind_at: "09:00",
}

describe("график смен", () => {
  it("строки ноября — по 30 дней, как в таблице", () => {
    expect(s.months["2026-11"].ivan).toHaveLength(30)
    expect([...s.months["2026-11"].ivan].filter((c) => c === "w")).toHaveLength(16)
    expect([...weekdays].filter((c) => c === "w")).toHaveLength(21)
  })
  it("кто на смене", () => {
    expect(statusOf(s, "ivan", "2026-11-02")).toBe("o")
    expect(dayCrew(s, "2026-11-01").work.map((p) => p.name)).toEqual(["Иван"])
    expect(dayCrew(s, "2026-11-25").maybe.map((p) => p.name)).toEqual(["Иван"])
    expect(dayCrew(s, "2026-12-01").filled).toBe(false)
  })
  it("тексты", () => {
    expect(reminderText(s, "2026-11-16")).toContain("понедельник 16 ноября")
    expect(reminderText(s, "2026-11-17")).toContain("Иван (@ivan_tg), Максим, Лиза")
    expect(todayText(s, "2026-11-30")).toContain("Завтра, вт 1 декабря: график не заполнен")
    const m = scheduleText(s, "month", "2026-11-16")
    expect(m).toContain("Смен в ноябре: Иван 16 (+4?), Максим 21, Лиза 21")
    expect(scheduleText(s, "two_weeks", "2026-11-16").split("\n").filter((l) => / — /.test(l))).toHaveLength(14)
  })
  it("омское время", () => {
    expect(omskNow(Date.parse("2026-11-15T19:30:00Z"))).toEqual({ date: "2026-11-16", time: "01:30" })
  })
})
