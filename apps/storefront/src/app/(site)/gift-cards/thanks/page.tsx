import type { Metadata } from "next"

import { GiftCardThanks } from "@/components/gift-card-thanks"
import { pageTitle } from "@/lib/site"

export const metadata: Metadata = { title: pageTitle("Спасибо за покупку"), robots: { index: false, follow: false } }

/** После оплаты подарочной карты: подтверждение и куда ушло письмо */
export default function GiftCardThanksPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-12 md:px-8">
      <GiftCardThanks />
    </div>
  )
}
