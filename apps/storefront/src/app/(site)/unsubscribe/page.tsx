import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"

import { pageTitle } from "@/lib/site"
import { storeFetch } from "@/lib/store-api"

export const metadata: Metadata = { title: pageTitle("Отписка от рассылки"), robots: { index: false, follow: false } }
export const instant = false

/** Отписка по ссылке из письма. */
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  await connection()
  const { e, t } = await searchParams
  const ok = !!e && !!t && (await storeFetch<{ ok: boolean }>("/store/newsletter/unsubscribe", { method: "POST", body: { email: e, token: t } }).then((r) => r.ok).catch(() => false))
  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-24 pt-16 md:px-8">
      <h1 className="text-[28px] tracking-tight md:text-[40px]">{ok ? "Вы отписались" : "Ссылка не сработала"}</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
        {ok ? `Больше не будем присылать новости на ${e}. Письма о ваших заказах будут приходить как обычно.` : "Возможно, ссылка устарела или скопирована не полностью. Напишите нам на admin@laflamme.ru — отпишем вручную."}
      </p>
      <Link href="/" className="mt-8 inline-block rounded-full bg-foreground px-6 py-3 text-[14px] text-background">На главную</Link>
    </div>
  )
}
