import type { Metadata } from "next"
import Link from "next/link"

import { TrackPurchase } from "@/components/track"
import { routes } from "@/lib/routes"
import { NOINDEX } from "@/lib/seo"
import { pageTitle } from "@/lib/site"

export const metadata: Metadata = { title: pageTitle("Заказ оформлен"), ...NOINDEX }
export const instant = false

/** «Заказ оформлен» (ТЗ, п. 6.4). Номер — из адреса. Письмо-подтверждение — этап 5. */
export default async function OrderConfirmed({ searchParams }: { searchParams: Promise<{ n?: string; paid?: string }> }) {
  const sp = await searchParams
  const n = sp.n?.replace(/\D/g, "").slice(0, 10)
  const paid = sp.paid === "1"
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="eyebrow text-muted">Спасибо!</p>
      <h1 className="mt-3 text-[32px] tracking-tight">Заказ {n ? `№ ${n} ` : ""}{paid ? "оплачен" : "оформлен"}</h1>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        {paid ? "Оплата получена. Мы соберём заказ и пришлём номер для отслеживания." : "Мы скоро свяжемся с вами по телефону, чтобы подтвердить заказ и согласовать получение."}
      </p>
      {n && <TrackPurchase order={n} />}
      <Link href={routes.newIn()} className="mt-8 inline-block rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Продолжить покупки</Link>
    </div>
  )
}
