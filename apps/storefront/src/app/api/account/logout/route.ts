import { NextResponse } from "next/server"

import { setAuthToken } from "@/lib/store-api"

export async function POST() {
  await setAuthToken(null)
  return NextResponse.json({ ok: true })
}
