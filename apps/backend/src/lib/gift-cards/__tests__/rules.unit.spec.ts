import { amountAllowed, applicable, DEFAULT_GIFT_SETTINGS as S, expiresAt, formatCode, looksLikeCode, newCode, normalizeCode, usable, validateGiftSettings } from "../rules"
import { sendAtFor } from "../engine"

describe("подарочные карты: код", () => {
  it("новый код: LF + 12 знаков без похожих символов", () => {
    const codes = new Set(Array.from({ length: 500 }, () => newCode()))
    expect(codes.size).toBe(500)
    for (const c of codes) expect(c).toMatch(/^LF[A-HJKMNP-Z2-9]{12}$/)
  })
  it("ввод покупателя: дефисы, пробелы, строчные, русская раскладка", () => {
    expect(normalizeCode("lf-abcd-2345-xyzw")).toBe("LFABCD2345XYZW")
    expect(normalizeCode(" LF ABCD 2345 XYZW ")).toBe("LFABCD2345XYZW")
    expect(normalizeCode("LF-АВСD-2345-ХУZW")).toBe("LFABCD2345XYZW")
    expect(formatCode("LFABCD2345XYZW")).toBe("LF-ABCD-2345-XYZW")
    expect(looksLikeCode("LF-ABCD-2345-XYZW")).toBe(true)
    expect(looksLikeCode("PROMO10")).toBe(false)
  })
})

describe("подарочные карты: правила", () => {
  const now = new Date("2026-11-13T12:00:00Z")
  it("можно ли платить картой", () => {
    expect(usable({ status: "active", balance: 500, expires_at: "2027-11-13" }, now)).toEqual({ ok: true })
    expect(usable(null, now)).toMatchObject({ ok: false, reason: "Карта не найдена — проверьте код" })
    expect(usable({ status: "pending", balance: 0, expires_at: null }, now).ok).toBe(false)
    expect(usable({ status: "disabled", balance: 500, expires_at: null }, now)).toMatchObject({ ok: false })
    expect(usable({ status: "active", balance: 500, expires_at: "2026-11-01" }, now)).toMatchObject({ reason: "Срок действия карты истёк" })
    expect(usable({ status: "active", balance: 0, expires_at: null }, now)).toMatchObject({ reason: "На карте не осталось средств" })
  })
  it("сколько списать: не больше остатка и суммы заказа", () => {
    expect(applicable(5000, 12990)).toBe(5000)
    expect(applicable(20000, 12990)).toBe(12990)
    expect(applicable(0, 100)).toBe(0)
  })
  it("номинал: готовый или своя сумма в пределах", () => {
    expect(amountAllowed(5000, S)).toBe(true)
    expect(amountAllowed(7500, S)).toBe(true)
    expect(amountAllowed(500, S)).toBe(false)
    expect(amountAllowed(200000, S)).toBe(false)
    expect(amountAllowed(1000.5, S)).toBe(false)
  })
  it("срок — год с покупки", () => {
    expect(expiresAt(new Date("2026-11-13T10:00:00Z"), 12).toISOString()).toBe("2027-11-13T10:00:00.000Z")
  })
  it("настройки", () => {
    expect(validateGiftSettings({ amounts: [5000, 3000, 3000] }).value?.amounts).toEqual([3000, 5000])
    expect(validateGiftSettings({ amounts: [] }).error).toBeTruthy()
    expect(validateGiftSettings({ min: 5000, max: 1000 }).error).toBeTruthy()
  })
  it("день отправки → 10:00 по Омску; сегодня или прошлое — сразу", () => {
    expect(sendAtFor("2026-11-20", now)?.toISOString()).toBe("2026-11-20T04:00:00.000Z")
    expect(sendAtFor("2026-11-01", now)).toBeNull()
    expect(sendAtFor(null, now)).toBeNull()
    expect(() => sendAtFor("2028-01-01", now)).toThrow()
  })
})
