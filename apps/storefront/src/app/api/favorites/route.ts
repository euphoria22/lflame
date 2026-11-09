import { NextRequest, NextResponse } from "next/server"

import { getAuthToken, storeFetch } from "@/lib/store-api"

/** Избранное вошедшего покупателя (в аккаунте). Без входа — пустой список и logged: false. */
export async function GET() {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ logged: false, favorites: [] })
  try {
    const { customer } = await storeFetch<{ customer: { favorites: string[] } }>("/store/account/me", { token })
    return NextResponse.json({ logged: true, favorites: customer.favorites ?? [] })
  } catch {
    return NextResponse.json({ logged: false, favorites: [] })
  }
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ ok: false }, { status: 401 })
  const { favorites } = (await req.json().catch(() => ({}))) as { favorites?: unknown }
  if (!Array.isArray(favorites)) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    await storeFetch("/store/account/me", { method: "POST", body: { favorites }, token })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
