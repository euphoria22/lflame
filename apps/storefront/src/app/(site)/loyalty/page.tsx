import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"

import { InfoPage } from "@/components/info-page"
import { formatPrice } from "@/lib/format"
import { pageTitle } from "@/lib/site"
import { storeFetch } from "@/lib/store-api"

export const metadata: Metadata = {
  title: pageTitle("Программа лояльности Laflamme Club — скидка до 15%"),
  description: "Laflamme Club: скидка от 5 до 15% на сайте и в магазине в Омске. Уровень зависит от суммы покупок за 12 месяцев, покупки с сайта и из магазина складываются.",
  alternates: { canonical: "/loyalty" },
}
export const instant = false

type Program = { enabled: boolean; tiers: { code: string; name: string; threshold: number; discount: number }[]; period_days: number; online_delay_days: number; excluded_brands: string[] }

/** Описание программы лояльности для всех (ТЗ, п. 6.7 «Гостю»). Уровни — из настроек админки. */
export default async function LoyaltyPage() {
  await connection()
  const p = await storeFetch<Program>("/store/loyalty/program").catch(() => null)
  const tiers = p?.tiers ?? []
  const discounts = tiers.map((t) => t.discount).filter((d) => d > 0)
  const minD = discounts.length ? Math.min(...discounts) : 0
  const maxD = discounts.length ? Math.max(...discounts) : 0
  const period = p?.period_days === 365 || !p ? "последние 12 месяцев" : `последние ${p.period_days} дней`
  return (
    <InfoPage
      crumbs={[{ name: "Laflamme Club", href: "/loyalty" }]}
      title="Laflamme Club"
      tab="/loyalty"
      intro={`Скидка${maxD ? ` от ${minD} до ${maxD}%` : ""} на сайте и в магазине в Омске. Уровень зависит от суммы ваших покупок за ${period}.`}
    >
      <div className="grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiers.map((t, i) => (
          <div key={t.code} className={`rounded-[22px] p-5 ${i === tiers.length - 1 ? "bg-foreground text-background" : "bg-surface"}`}>
            <p className="eyebrow opacity-60">{t.threshold ? `от ${formatPrice(t.threshold)}` : "старт"}</p>
            <p className="tag-font mt-3 text-[17px] uppercase">{t.name}</p>
            <p className="tag-font mt-1 text-[26px]">{t.discount ? `−${t.discount}%` : "0%"}</p>
            {t.code === "PRIVATE" && <p className="mt-2 text-[12px] opacity-70">+ закрытые распродажи и ранний доступ</p>}
          </div>
        ))}
      </div>

      <div className="info-text mt-14 max-w-3xl">
        <h2>Как получить скидку</h2>
        <ol>
          <li>Войдите на сайте и укажите телефон в профиле. В магазине назовите этот же номер на кассе.</li>
          <li>Покупайте на сайте или в магазине. Все покупки складываются в одну сумму.</li>
          <li>Сумма дошла до следующего уровня: скидка включится со следующей покупки.</li>
        </ol>
        <h2>Что важно знать</h2>
        <ul>
          <li>Заказ с сайта попадает в сумму через {p?.online_delay_days ?? 7} дней после получения, когда пройдёт срок возврата. Покупка в магазине считается сразу.</li>
          <li>Скидка действует и на вещи, которые уже уценены. Считается от цены на сайте.</li>
          <li>С промокодами и акциями скидка не складывается. Сайт сам применит то, что выгоднее.</li>
          <li>В сумму идут покупки за {period}. Когда старые покупки выходят из этого срока, уровень может снизиться. Об этом мы напишем заранее.</li>
          {!!p?.excluded_brands.length && <li>На эти бренды скидка уровня не действует: {p.excluded_brands.join(", ")}.</li>}
        </ul>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href="/account/login?next=/account/club" className="inline-block rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Мой уровень</Link>
        <Link href="/loyalty/rules" className="pill">Полные правила</Link>
      </div>
    </InfoPage>
  )
}
