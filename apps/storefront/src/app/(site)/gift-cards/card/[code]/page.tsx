import type { Metadata } from "next"

import { GiftCardPage } from "@/components/gift-card-page"
import { pageTitle } from "@/lib/site"

export const metadata: Metadata = { title: pageTitle("Подарочная карта"), robots: { index: false, follow: false } }
// Адрес с кодом карты — только при запросе (как остальные страницы с параметрами), без предсборки
export const instant = false

/** Страница карты по ссылке из письма и QR: остаток, срок, QR для кассы; продавцу — переход в админку */
export default async function GiftCardCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return (
    <div className="mx-auto max-w-[560px] px-4 pb-24 pt-8 md:px-8">
      <GiftCardPage code={code} />
    </div>
  )
}
