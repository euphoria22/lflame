import { NextResponse } from "next/server"

import { storeFetch } from "@/lib/store-api"

/** Настройки оформления из админки (порог бесплатной доставки, онлайн-оплата). */
export async function GET() {
  try {
    return NextResponse.json(await storeFetch("/store/checkout/options"))
  } catch {
    return NextResponse.json({ online_payment: false, free_shipping_from: 0 }, { status: 502 })
  }
}
