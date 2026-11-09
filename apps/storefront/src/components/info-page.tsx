import type { ReactNode } from "react"

import { Breadcrumbs, type Crumb } from "./breadcrumbs"

/**
 * Единый шаблон информационных страниц: оплата, доставка, возврат, контакты, оферта, программа лояльности.
 * Крошки и заголовок — по левому краю сайта, как в каталоге и блоге; текст — колонкой удобной ширины.
 */
export function InfoPage({ crumbs, title, intro, children }: { crumbs: Crumb[]; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-4 pb-24 pt-6 md:px-8">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-[28px] tracking-tight md:text-[40px]">{title}</h1>
      {intro && <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-muted">{intro}</p>}
      <div className="mt-10">{children}</div>
    </div>
  )
}
