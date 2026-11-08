import { NextRequest, NextResponse } from "next/server"

import { getCartId, setAuthToken, storeFetch } from "@/lib/store-api"

const BACKEND = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")

async function auth(path: string, init: { body?: unknown; token?: string }) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const data = (await res.json().catch(() => ({}))) as { token?: string; message?: string }
  if (!res.ok || !data.token) throw new Error(data.message ?? "Неверный или устаревший код")
  return data.token
}

const hasActor = (token: string) => {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { actor_id?: string }
    return Boolean(payload.actor_id)
  } catch {
    return false
  }
}

/**
 * Вход по коду: проверка кода -> (первый вход) создание покупателя -> токен в httpOnly-cookie.
 * Текущая корзина привязывается к покупателю.
 */
export async function POST(req: NextRequest) {
  const { email, code } = (await req.json().catch(() => ({}))) as { email?: string; code?: string }
  const mail = String(email ?? "").trim().toLowerCase()
  try {
    let token = await auth("/auth/customer/otp", { body: { email: mail, code: String(code ?? "").replace(/\D/g, "") } })
    if (!hasActor(token)) {
      await storeFetch("/store/customers", { method: "POST", body: { email: mail }, token })
      token = await auth("/auth/token/refresh", { token })
    }
    await setAuthToken(token)
    const cartId = await getCartId()
    if (cartId) await storeFetch(`/store/carts/${cartId}/customer`, { method: "POST", token }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Не получилось войти" }, { status: 401 })
  }
}
