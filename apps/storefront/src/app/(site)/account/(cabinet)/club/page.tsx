import type { Metadata } from "next"
import Link from "next/link"

import { Card, ClubCard } from "@/components/account-parts"
import { getAccount } from "@/lib/account"
import { formatPrice } from "@/lib/format"
import { NOINDEX } from "@/lib/seo"
import { pageTitle } from "@/lib/site"
import { storeFetch } from "@/lib/store-api"

export const instant = false
export const metadata: Metadata = { title: pageTitle("Laflamme Club"), ...NOINDEX }

const STEPS = [
  ["Укажите телефон", "Войдите на сайте и добавьте номер в профиль. В магазине назовите этот номер на кассе."],
  ["Покупайте", "Покупки на сайте и в магазине в Омске складываются в одну сумму."],
  ["Получите скидку", "Сумма дошла до следующего уровня: скидка включится со следующей покупки."],
]

/** Laflamme Club в кабинете: уровень, уровни программы, как работает, правила, история покупок. */
export default async function ClubPage() {
  const { loyalty } = await getAccount()
  const program = await storeFetch<{ excluded_brands?: string[] }>("/store/loyalty/program").catch(() => null)
  if (!loyalty?.enabled) return <Card title="Laflamme Club"><p className="text-[14px] text-muted">Программа временно недоступна.</p></Card>
  const tiers = [...loyalty.tiers].sort((a, b) => a.threshold - b.threshold)
  const excluded = program?.excluded_brands ?? []
  const rules: [string, string[]][] = [
    ["Что идёт в сумму", [
      "Заказы с сайта: через 7 дней после получения, когда пройдёт срок возврата.",
      "Покупки в магазине: сразу, в день покупки.",
      "Вещи со скидкой и из Outlet тоже считаются.",
      "Считаем сумму, которую вы заплатили, за последние 12 месяцев.",
    ]],
    ["Что не идёт в сумму", [
      "Отменённые и невыкупленные заказы.",
      "Возвраты: их стоимость вычитаем из суммы.",
      "Доставка.",
    ]],
    ["Как работает скидка", [
      "Включается в корзине сама, когда вы вошли на сайт.",
      "Действует и на уценённые вещи, считается от цены на сайте.",
      "С промокодом не складывается. Сайт выберет то, что выгоднее.",
      "Покупки старше 12 месяцев выходят из суммы, и уровень может снизиться. Напишем об этом заранее.",
    ]],
    ["Исключения", [
      ...(excluded.length ? [`На эти бренды скидка не действует: ${excluded.join(", ")}.`] : []),
      "На некоторые товары скидка не действует. На их странице так и написано.",
      "Их стоимость всё равно идёт в сумму покупок.",
    ]],
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-[28px] tracking-tight md:text-[40px]">Laflamme Club</h1>
      <ClubCard s={loyalty} />

      <Card title="Уровни программы">
        <p className="-mt-2 mb-5 text-[14px] text-muted">Уровень зависит от суммы ваших покупок за последние 12 месяцев.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {tiers.map((t, i) => {
            const cur = loyalty.confirmed && t.code === loyalty.level.code
            const next = tiers[i + 1]
            return (
              <div key={t.code} className={`rounded-[20px] border p-5 ${cur ? "border-foreground" : "border-line bg-surface/60"}`}>
                <p className="tag-font text-[15px] uppercase">{t.name}</p>
                <p className="mt-2 text-[30px] leading-none tracking-tight">{t.discount}%</p>
                <p className="mt-3 text-[12px] text-muted">{t.threshold ? `от ${formatPrice(t.threshold)}` : next ? `до ${formatPrice(next.threshold - 1)}` : "старт"}</p>
                {cur && <p className="eyebrow mt-3">Ваш уровень</p>}
                {t.code === "PRIVATE" && <p className="mt-3 text-[12px] leading-snug">+ закрытые распродажи и ранний доступ к новинкам</p>}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Как получить скидку">
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map(([h, t], i) => (
            <li key={h} className="rounded-[20px] border border-line bg-surface/60 p-5">
              <p className="text-[12px] text-muted">0{i + 1}</p>
              <p className="mt-3 text-[17px]">{h}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{t}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Правила программы">
        <div className="grid gap-3 md:grid-cols-2">
          {rules.map(([h, list]) => (
            <div key={h} className="rounded-[20px] border border-line bg-surface/60 p-5">
              <p className="text-[16px]">{h}</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted">{list.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <Link href="/loyalty/rules" className="pill mt-5">Полные правила</Link>
      </Card>

      {!!loyalty.history.length && (
        <Card title="История покупок">
          <ul className="divide-y divide-line text-[14px]">
            {loyalty.history.slice(0, 30).map((h, i) => (
              <li key={i} className="flex justify-between gap-4 py-3">
                <span><span className="text-muted">{new Date(h.date).toLocaleDateString("ru-RU")}</span> · {h.title}{h.status === "pending" ? <span className="text-muted"> · ожидает зачёта</span> : null}</span>
                <span className="whitespace-nowrap">{h.amount > 0 ? "+" : ""}{formatPrice(h.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
