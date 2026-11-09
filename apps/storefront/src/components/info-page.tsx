import Link from "next/link"
import type { ReactNode } from "react"

import { Breadcrumbs, type Crumb } from "./breadcrumbs"

/** Вкладки раздела «Покупателям» — как на прежнем сайте. */
export const HELP_TABS = [
  { href: "/delivery", label: "Доставка" },
  { href: "/payment", label: "Оплата" },
  { href: "/returns", label: "Обмен и возврат" },
  { href: "/loyalty", label: "Laflamme Club" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
]

function HelpTabs({ active }: { active: string }) {
  return (
    // На телефоне — сетка 2×3, все разделы видны сразу (без прокрутки вбок); на компьютере — одна строка
    <nav aria-label="Покупателям" className="mt-6">
      <ul className="grid grid-cols-2 gap-1 rounded-[24px] border border-line p-1 md:grid-cols-6 md:rounded-full">
        {HELP_TABS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={t.href === active ? "page" : undefined}
              className={`eyebrow block whitespace-nowrap rounded-full px-3 py-3 text-center transition-colors ${t.href === active ? "bg-foreground text-background" : "hover:bg-surface"}`}>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Единый шаблон информационных страниц: ширина и отступы — как у шапки и подвала,
 * у страниц раздела «Покупателям» — вкладки сверху.
 */
export function InfoPage({ crumbs, title, intro, tab, children }: { crumbs: Crumb[]; title: string; intro?: ReactNode; tab?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-24 pt-6 md:px-8">
      <Breadcrumbs items={crumbs} />
      {tab && <HelpTabs active={tab} />}
      <h1 className={`${tab ? "mt-10" : "mt-6"} text-[28px] tracking-tight md:text-[40px]`}>{title}</h1>
      {intro && <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-muted">{intro}</p>}
      <div className="mt-10">{children}</div>
    </div>
  )
}

/** Карточка раздела: серая подложка, как на прежнем сайте. */
export function InfoCard({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] bg-surface p-6 md:p-8 ${className}`}>
      {title && <h2 className="mb-4 text-[20px] tracking-tight md:text-[22px]">{title}</h2>}
      {children}
    </section>
  )
}
