import { NextRequest, NextResponse } from "next/server"

import { rateLimit } from "@/lib/rate-limit"
import { storeFetch } from "@/lib/store-api"

/** Покупка подарочной карты: ссылка на оплату в Т-Банке */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "gift-buy", 10, 600)
  if (limited) return limited
  const body = await req.json().catch(() => ({}))
  try {
    const r = await storeFetch<{ id: string; payment_url: string }>("/store/gift-cards/purchase", { method: "POST", body })
    return NextResponse.json({ redirect: r.payment_url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    return NextResponse.json({ error: /Сумма|email|имя|Дата|продаются/i.test(msg) ? msg.replace(/^.*?:\s*/, "") : "Не получилось перейти к оплате. Попробуйте ещё раз." }, { status: 400 })
  }
}
