import { timingSafeEqual } from "crypto"
import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

/** Сброс кэша витрины по событию из Medusa или CMS (ТЗ, п. 7.1). */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET ?? ""
  const got = req.headers.get("x-revalidate-secret") ?? ""
  const ok = secret.length > 0 && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret))
  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as { tags?: string[] }
  const tags = (body.tags ?? ["catalog"]).filter((t) => /^[a-z0-9:_-]{1,100}$/i.test(t))
  // Сразу устаревает: следующий посетитель получает свежие данные, а не прежнюю версию
  // (с "max" первый после правки видел старую страницу — например, без пометки «Предзаказ»)
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 })
  }
  return NextResponse.json({ ok: true, tags })
}
