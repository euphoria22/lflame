import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"

import { InfoPage } from "@/components/info-page"
import { formatPrice } from "@/lib/format"
import { pageTitle } from "@/lib/site"
import { storeFetch } from "@/lib/store-api"

export const metadata: Metadata = {
  title: pageTitle("Программа лояльности Laflamme Club — скидка до 15%"),
  description: "Скидка до 15% по сумме покупок за 12 месяцев — на сайте и в магазине в Омске. Уровни BASE, MEMBER, SELECT, ICON, PRIVATE.",
  alternates: { canonical: "/loyalty" },
}
export const instant = false

type Program = { enabled: boolean; tiers: { code: string; name: string; threshold: number; discount: number }[]; period_days: number; online_delay_days: number; excluded_brands: string[] }

/** Описание программы лояльности для всех (ТЗ, п. 6.7 «Гостю»). Уровни — из настроек админки. */
export default async function LoyaltyPage() {
  await connection()
  const p = await storeFetch<Program>("/store/loyalty/program").catch(() => null)
  const tiers = p?.tiers ?? []
  return (
    <InfoPage
      crumbs={[{ name: "Laflamme Club", href: "/loyalty" }]}
      title="Laflamme Club"
      tab="/loyalty"
      intro="Чем больше покупаете — тем больше скидка. Считаем все покупки за последние 12 месяцев: на сайте и в магазине в Омске. Скидка действует везде — онлайн и в магазине, со следующей покупки после перехода на уровень."
    >
      <div className="grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiers.map((t, i) => (
          <div key={t.code} className={`rounded-[22px] p-5 ${i === tiers.length - 1 ? "bg-foreground text-background" : "bg-surface"}`}>
            <p className="eyebrow opacity-60">{t.threshold ? `от ${formatPrice(t.threshold)}` : "старт"}</p>
            <p className="mt-3 text-[20px] tracking-tight">{t.name}</p>
            <p className="mt-1 text-[28px]">{t.discount ? `−${t.discount}%` : "0%"}</p>
            {t.code === "PRIVATE" && <p className="mt-2 text-[12px] opacity-70">+ закрытые распродажи и ранний доступ</p>}
          </div>
        ))}
      </div>

      <div className="info-text mt-14 max-w-3xl">
        <h2>Как это работает</h2>
        <p>Авторизуйтесь на сайте и укажите телефон — по нему мы находим ваши покупки на сайте и в магазине. В магазине просто назовите номер телефона.</p>
        <p>Покупка на сайте засчитывается через {p?.online_delay_days ?? 7} дней после получения заказа (время на возврат). Покупка в магазине — сразу.</p>
        <p>Скидка уровня действует и на товары со скидкой: считается от текущей цены. С промокодами и акциями не суммируется — применяем то, что выгоднее для вас.</p>
        <p>Учитываются покупки за {p?.period_days === 365 || !p ? "последние 12 месяцев" : `последние ${p.period_days} дней`}: старые покупки постепенно выбывают, и уровень может понизиться. Мы предупредим заранее письмом.</p>
        {!!p?.excluded_brands.length && <p>Скидка уровня не действует на бренды: {p.excluded_brands.join(", ")}.</p>}
        <p><Link href="/loyalty/rules">Правила Laflamme Club</Link></p>
      </div>

      <div className="mt-10">
        <Link href="/account/login?next=/account/club" className="inline-block rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Мой уровень</Link>
      </div>
    </InfoPage>
  )
}
