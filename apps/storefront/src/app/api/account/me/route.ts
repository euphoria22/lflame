import { NextRequest, NextResponse } from "next/server"

import { currentCustomer, getAuthToken, StoreApiError, storeFetch } from "@/lib/store-api"

/** Обновление имени и телефона в профиле. */
export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Авторизуйтесь" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { first_name?: string; last_name?: string; phone?: string }
  try {
    return NextResponse.json(await storeFetch("/store/account/me", { method: "POST", body, token }))
  } catch (e) {
    return NextResponse.json({ error: e instanceof StoreApiError ? e.message : "Не сохранилось" }, { status: 400 })
  }
}

/** Вошедший покупатель (только email и имя) — чтобы подставлять почту в формы. */
export async function GET() {
  const c = await currentCustomer()
  return NextResponse.json({ customer: c ? { email: c.email, first_name: c.first_name } : null }, { headers: { "Cache-Control": "no-store" } })
}
