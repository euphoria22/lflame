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
  ["Покупайте", "На сайте под своим аккаунтом с телефоном в профиле или в магазине в Омске — назовите номер телефона."],
  ["Сумма покупок растёт", "Заказ на сайте засчитывается через 7 дней после получения (время на возврат), покупка в магазине — сразу."],
  ["Уровень меняется автоматически", "Как только сумма за 12 месяцев доходит до порога, новый уровень и скидка включаются со следующей покупки."],
]

/** Laflamme Club в кабинете: уровень, уровни программы, как работает, правила, история покупок. */
export default async function ClubPage() {
  const { loyalty } = await getAccount()
  const program = await storeFetch<{ excluded_brands?: string[] }>("/store/loyalty/program").catch(() => null)
  if (!loyalty?.enabled) return <Card title="Laflamme Club"><p className="text-[14px] text-muted">Программа временно недоступна.</p></Card>
  const tiers = [...loyalty.tiers].sort((a, b) => a.threshold - b.threshold)
  const excluded = program?.excluded_brands ?? []
  const rules: [string, string[]][] = [
    ["Какие покупки учитываются", [
      "оплаченные и полученные заказы на сайте — через 7 дней после получения;",
      "покупки в магазине в Омске — в день покупки;",
      "товары со скидкой и из Sale — тоже учитываются;",
      "считается оплаченная сумма после всех скидок, за последние 12 месяцев.",
    ]],
    ["Какие покупки не учитываются", [
      "отменённые и невыкупленные заказы;",
      "возвращённые товары — их стоимость вычитается из суммы;",
      "стоимость доставки.",
    ]],
    ["Как работает скидка", [
      "скидка вашего уровня применяется в корзине автоматически, после входа на сайт;",
      "действует и на товары со скидкой — считается от текущей цены;",
      "не суммируется с промокодами — сайт применит ту скидку, что выгоднее для вас;",
      "покупки старше 12 месяцев выбывают из суммы, и уровень может понизиться — предупредим письмом заранее.",
    ]],
    ["Исключения", [
      ...(excluded.length ? [`скидка не действует на бренды: ${excluded.join(", ")};`] : []),
      "отдельные товары могут быть исключены — на странице такого товара написано «Скидка Laflamme Club на этот товар не действует»;",
      "их стоимость всё равно учитывается в сумме покупок.",
    ]],
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-[28px] tracking-tight md:text-[40px]">Laflamme Club</h1>
      <ClubCard s={loyalty} />

      <Card title="Уровни программы">
        <p className="-mt-2 mb-5 text-[14px] text-muted">Чем больше сумма ваших покупок за 12 месяцев, тем выше уровень и скидка.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {tiers.map((t, i) => {
            const cur = loyalty.confirmed && t.code === loyalty.level.code
            const next = tiers[i + 1]
            return (
              <div key={t.code} className={`rounded-[20px] border p-5 ${cur ? "border-foreground" : "border-line bg-surface/60"}`}>
                <p className="text-[17px]">{t.name}</p>
                <p className="mt-2 text-[30px] leading-none tracking-tight">{t.discount}%</p>
                <p className="mt-3 text-[12px] text-muted">{t.threshold ? `от ${formatPrice(t.threshold)}` : next ? `до ${formatPrice(next.threshold - 1)}` : "старт"}</p>
                {cur && <p className="eyebrow mt-3">Ваш уровень</p>}
                {t.code === "PRIVATE" && <p className="mt-3 inline-block rounded-full border border-foreground px-3 py-1 text-[11px]">Закрытые распродажи и ранний доступ</p>}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Как работает программа">
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
        <p className="mt-4 text-[13px] text-muted">Полные условия — <Link href="/loyalty/rules" className="underline underline-offset-4">правила Laflamme Club</Link>.</p>
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
