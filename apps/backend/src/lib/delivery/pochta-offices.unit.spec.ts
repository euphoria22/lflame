import { formatHours, mapOffice } from "./pochta-offices"

describe("отделения Почты", () => {
  it("часы работы сжимаются по одинаковым дням", () => {
    const h = [1, 2, 3, 4, 5].map((d) => ({ "weekday-id": d, "begin-worktime": "08:00:00", "end-worktime": "20:00:00" }))
      .concat([{ "weekday-id": 6, "begin-worktime": "09:00:00", "end-worktime": "18:00:00" }])
    expect(formatHours(h)).toBe("Пн–Пт 08:00–20:00, Сб 09:00–18:00")
  })
  it("закрытые отделения пропускаются", () => {
    expect(mapOffice({ "postal-code": "644007", "is-temporary-closed": true })).toBeNull()
    expect(mapOffice({ "postal-code": "644007", "address-source": "Омск, ул. Партизанская, 10", latitude: "54.98", longitude: 73.37 }))
      .toMatchObject({ postal_code: "644007", lat: 54.98, lon: 73.37 })
  })
})
