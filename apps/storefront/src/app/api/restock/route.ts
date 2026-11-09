import { NextRequest, NextResponse } from "next/server"

import { StoreApiError, storeFetch } from "@/lib/store-api"

/** «Сообщить о поступлении»: подписка на закончившийся размер. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; variant_id?: string }
  const email = String(body.email ?? "").trim().slice(0, 200)
  const variant = String(body.variant_id ?? "").slice(0, 100)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Проверьте email" }, { status: 400 })
  if (!variant) return NextResponse.json({ error: "Выберите размер" }, { status: 400 })
  try {
    const r = await storeFetch<{ already: boolean }>("/store/restock", { method: "POST", body: { email, variant_id: variant } })
    return NextResponse.json({ ok: true, already: r.already })
  } catch (e) {
    return NextResponse.json({ error: e instanceof StoreApiError && e.status < 500 ? e.message : "Не получилось. Попробуйте ещё раз." }, { status: 400 })
  }
}
