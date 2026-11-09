import { NextResponse } from "next/server"

import { getAuthToken, storeFetch } from "@/lib/store-api"

/** Уровень программы для прогресса в корзине. Без входа — logged: false. */
export async function GET() {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ logged: false })
  try {
    const { loyalty } = await storeFetch<{ loyalty: unknown }>("/store/account/me/loyalty", { token })
    return NextResponse.json({ logged: true, loyalty })
  } catch {
    return NextResponse.json({ logged: false })
  }
}
