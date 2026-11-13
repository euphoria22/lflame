import { NextRequest, NextResponse } from "next/server"

const BACKEND = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

/** QR-код подарочной карты (PNG) — для страницы карты */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!/^LF[A-Z0-9]{12}$/.test(code)) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
  const r = await fetch(`${BACKEND}/store/gift-cards/qr/${code}`, { headers: { "x-publishable-api-key": KEY }, cache: "no-store" }).catch(() => null)
  if (!r?.ok) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
  return new NextResponse(await r.arrayBuffer(), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } })
}
