import sharp from "sharp"
import { analyze, pickOrder, preparePostPhotos } from "../photos"

const img = (w: number, h: number, bg: string, fg = "#222222") =>
  sharp({ create: { width: w, height: h, channels: 3, background: bg } })
    .composite([{ input: { create: { width: Math.round(w / 2), height: Math.round(h / 2), channels: 3, background: fg } }, gravity: "center" }])
    .jpeg().toBuffer()

describe("фото для поста", () => {
  it("белый фон — каталожное, бежевый — на модели", async () => {
    expect((await analyze(await img(900, 900, "#ffffff"))).kind).toBe("white")
    expect((await analyze(await img(800, 1000, "#f6f6f4"))).kind).toBe("white")
    // Светло-серый фон каталожных фото Calvin Klein
    expect((await analyze(await img(800, 1000, "#d2d2d2"))).kind).toBe("white")
    // Студия, светлый тёплый фон
    expect((await analyze(await img(800, 1000, "#e6ddd0"))).kind).toBe("model")
    const studio = await analyze(await img(800, 1000, "#cfc6b8"))
    expect(studio.kind).toBe("model")
    expect(studio.bg.r).toBeGreaterThan(190)
  })

  it("первый пример из канала: 10 фото → 3 белых первым рядом, 3 на модели вторым", () => {
    // белое, модель ×5, белое, деталь (белая), деталь (тёмная), бирка (тёмная)
    const kinds = ["white", "model", "model", "model", "model", "model", "white", "white", "model", "model"] as const
    expect(pickOrder([...kinds])).toEqual([0, 6, 7, 1, 2, 3])
  })

  it("второй пример: белое, модель, модель, модель, белое, белое → белые первым рядом", () => {
    expect(pickOrder(["white", "model", "model", "model", "white", "white"])).toEqual([0, 4, 5, 1, 2, 3])
  })

  it("два белых — сетка 2+2", () => {
    expect(pickOrder(["white", "model", "model", "white", "model"])).toEqual([0, 3, 1, 2])
  })

  it("одного вида — 6 или 4 фото, одно белое — первым", () => {
    expect(pickOrder(Array(9).fill("model"))).toEqual([0, 1, 2, 3, 4, 5])
    expect(pickOrder(Array(5).fill("white"))).toEqual([0, 1, 2, 3])
    expect(pickOrder(["model", "white", "model", "model", "model", "model", "model"])).toEqual([1, 0, 2, 3, 4, 5])
    expect(pickOrder(["white", "model"])).toEqual([0, 1])
  })

  it("все фото — 1080×1350, без обрезки", async () => {
    const out = await preparePostPhotos([await img(900, 900, "#ffffff"), await img(800, 1200, "#cfc6b8"), await img(1200, 800, "#ffffff")])
    expect(out).toHaveLength(3)
    for (const b of out) {
      const m = await sharp(Buffer.from(await b.arrayBuffer())).metadata()
      expect([m.width, m.height]).toEqual([1080, 1350])
    }
  })
})
