import { clientIp, overLimit } from "../login-guard"

describe("вход в админку: защита", () => {
  it("адрес — последний в X-Forwarded-For (его ставит Caddy)", () => {
    expect(clientIp({ headers: { "x-forwarded-for": "6.6.6.6, 91.1.2.3" } })).toBe("91.1.2.3")
    expect(clientIp({ headers: {}, ip: "10.0.0.1" })).toBe("10.0.0.1")
  })
  it("не больше 10 попыток за 15 минут с адреса", () => {
    const t = 1_800_000_000_000
    for (let i = 0; i < 10; i++) expect(overLimit("1.1.1.1", t + i)).toBe(false)
    expect(overLimit("1.1.1.1", t + 11)).toBe(true)
    expect(overLimit("2.2.2.2", t + 12)).toBe(false)
    expect(overLimit("1.1.1.1", t + 16 * 60_000)).toBe(false)
  })
})
