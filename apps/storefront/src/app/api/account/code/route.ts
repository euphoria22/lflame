import { NextRequest, NextResponse } from "next/server"

import { StoreApiError, storeFetch } from "@/lib/store-api"

export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  try {
    await storeFetch("/store/account/code", { method: "POST", body: { email } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const status = e instanceof StoreApiError ? e.status : 502
    return NextResponse.json({ error: e instanceof StoreApiError ? e.message : "Не удалось отправить код" }, { status })
  }
}
