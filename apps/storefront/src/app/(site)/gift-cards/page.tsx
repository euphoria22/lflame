import type { Metadata } from "next"
import { connection } from "next/server"

import { GiftCardBalance } from "@/components/gift-card-balance"
import { GiftCardForm, type GiftConfig } from "@/components/gift-card-form"
import { InfoPage } from "@/components/info-page"
import { pageTitle } from "@/lib/site"
import { storeFetch } from "@/lib/store-api"

export const metadata: Metadata = {
  title: pageTitle("Подарочная карта Laflamme — электронный сертификат"),
  description: "Электронная подарочная карта Laflamme от 1 000 ₽: придёт на email с поздравлением в нужный день. Тратится частями на сайте и в шоуруме в Омске, действует 1 год.",
  alternates: { canonical: "/gift-cards" },
}
export const instant = false

const FAQ: [string, string][] = [
  ["Как получатель узнает о подарке?", "Мы пришлём ему письмо с картой, кодом и вашим поздравлением — сразу после оплаты или утром выбранного дня. Вам придёт чек и копия карты: если письмо не дойдёт, код можно переслать."],
  ["Где можно потратить карту?", "На сайте — введите код при оформлении заказа в поле «Подарочная карта». В шоуруме в Омске (ул. Партизанская, 5а/8) — назовите код продавцу."],
  ["Можно потратить не всю сумму сразу?", "Да. Остаток сохраняется на карте, его можно потратить в следующий раз — до конца срока действия."],
  ["Сколько действует карта?", "1 год с момента покупки. Дата окончания указана в письме и видна при проверке баланса."],
  ["Действуют ли скидки Laflamme Club и акции?", "Да. Подарочная карта — это способ оплаты, а не скидка: цены, скидки уровня и акции считаются как обычно, карта уменьшает сумму к оплате. Покупки, оплаченные картой, засчитываются в уровень Laflamme Club."],
  ["Что, если на карте не хватает?", "Доплатите разницу картой или СБП при оформлении заказа. Если карта покрывает весь заказ, доплачивать ничего не нужно."],
  ["Что будет с картой при возврате товара?", "Если заказ отменён или возвращён, оплаченная картой сумма вернётся на ту же карту."],
]

/** Подарочные карты: покупка (себе или в подарок с отправкой в нужный день), проверка баланса, ответы на вопросы. */
export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  await connection()
  const [config, sp] = await Promise.all([
    storeFetch<GiftConfig>("/store/gift-cards").catch((): GiftConfig => ({ enabled: false, amounts: [], min: 0, max: 0, validity_months: 12, online_payment: false })),
    searchParams,
  ])
  return (
    <InfoPage
      crumbs={[{ name: "Подарочная карта", href: "/gift-cards" }]}
      title="Подарочная карта"
      intro="Лучший подарок — тот, что выбрали сами. Электронная карта придёт на почту с вашим поздравлением, а потратить её можно на сайте и в шоуруме в Омске."
    >
      <GiftCardForm config={config} failed={sp.payment === "failed"} />

      <section id="balance" className="mt-20 scroll-mt-28">
        <h2 className="text-[22px] tracking-tight md:text-[28px]">Проверить баланс</h2>
        <p className="mb-5 mt-2 text-[14px] text-muted">Код — в письме с картой, вида LF-XXXX-XXXX-XXXX.</p>
        <GiftCardBalance />
      </section>

      <section className="mt-20 max-w-3xl">
        <h2 className="text-[22px] tracking-tight md:text-[28px]">Вопросы и ответы</h2>
        <div className="mt-5 divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px]">
                {q}<span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </InfoPage>
  )
}
