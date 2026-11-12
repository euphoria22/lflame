import { cleanLabels, trackingUrl } from "../shipment-labels"

describe("трек-номера отправки", () => {
  it("пустая строка формы убирается", () => {
    expect(cleanLabels([{ tracking_number: "", tracking_url: "", label_url: "" }])).toEqual([])
  })
  it("ссылки подставляются по номеру", () => {
    expect(cleanLabels([{ tracking_number: " 64410012345678 ", tracking_url: "", label_url: "" }])).toEqual([
      { tracking_number: "64410012345678", tracking_url: "https://www.pochta.ru/tracking?barcode=64410012345678", label_url: "https://www.pochta.ru/tracking?barcode=64410012345678" },
    ])
    expect(trackingUrl("RA123456789RU")).toContain("pochta.ru")
    expect(trackingUrl("1234567890")).toContain("cdek.ru")
  })
  it("заполнена ссылка, пуста этикетка — этикетка = ссылка", () => {
    expect(cleanLabels([{ tracking_number: "10347899349", tracking_url: "https://www.cdek.ru/ru/tracking/?order_id=10347899349", label_url: "" }])[0].label_url)
      .toBe("https://www.cdek.ru/ru/tracking/?order_id=10347899349")
  })
})
