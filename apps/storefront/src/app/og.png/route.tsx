import { ImageResponse } from "next/og"

/**
 * Обложка для ссылок в соцсетях и мессенджерах (Open Graph) — у страниц без своей картинки:
 * главная, каталог, бренды, служебные. Латиницей: встроенный шрифт не знает кириллицу.
 */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b0b0b", color: "#ffffff", padding: 72 }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: "#8a8a8a" }}>OMSK · ONLINE</div>
        <div style={{ display: "flex", fontSize: 168, fontWeight: 600, letterSpacing: -8, lineHeight: 1 }}>la:flamme</div>
        <div style={{ display: "flex", fontSize: 30, color: "#bdbdbd" }}>Stone Island · C.P. Company · Carhartt WIP · Calvin Klein · MISBHV</div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
