import { cacheTag } from "next/cache"
import Link from "next/link"

import { GENDERS, routes } from "@/lib/routes"
import { SITE_NAME } from "@/lib/site"
import { getNav } from "./nav-data"

/** Подвал: разделы, топ-бренды, информационные страницы (ТЗ, п. 7.12), реквизиты (п. 8.7). */
export async function Footer() {
  "use cache"
  cacheTag("catalog")
  const nav = await getNav()
  const year = new Date().getFullYear()
  const col = "text-[13px] leading-7 text-muted"
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-[1680px] grid-cols-2 gap-10 px-4 py-14 md:grid-cols-5 md:px-8">
        <div className="col-span-2 md:col-span-1">
          <p className="text-[15px] font-semibold tracking-[0.32em]">{SITE_NAME}</p>
          <p className="mt-4 max-w-xs text-[13px] leading-6 text-muted">Мультибрендовый магазин оригинальной одежды, обуви и аксессуаров.</p>
        </div>
        <div>
          <p className="eyebrow mb-4">Каталог</p>
          <ul className={col}>
            <li><Link href={routes.newIn()}>Новинки</Link></li>
            {GENDERS.map((g) => <li key={g.slug}><Link href={routes.gender(g.slug)}>{g.name}</Link></li>)}
            <li><Link href={routes.brands()}>Бренды</Link></li>
            <li><Link href={routes.sale()}>Sale</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-4">Бренды</p>
          <ul className={col}>
            {nav.brands.slice(0, 8).map((b) => <li key={b.handle}><Link href={routes.brand(b.handle)}>{b.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-4">Покупателям</p>
          <ul className={col}>
            <li><Link href={routes.page("delivery")}>Доставка</Link></li>
            <li><Link href={routes.page("payment")}>Оплата</Link></li>
            <li><Link href={routes.page("returns")}>Обмен и возврат</Link></li>
            <li><Link href={routes.page("loyalty")}>Программа лояльности</Link></li>
            <li><Link href={routes.page("contacts")}>Контакты</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-4">О компании</p>
          <ul className={col}>
            <li><Link href={routes.page("about")}>О магазине</Link></li>
            <li><Link href={routes.page("offer")}>Публичная оферта</Link></li>
            <li><Link href={routes.page("privacy")}>Политика конфиденциальности</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1680px] flex-col gap-2 border-t border-line px-4 py-6 text-[12px] text-subtle md:flex-row md:justify-between md:px-8">
        <p>© {year} {SITE_NAME}</p>
        {/* ТЗ, п. 8.7: реквизиты продавца — заполнить */}
        <p>ИП / ООО «…», ИНН …, ОГРН …</p>
      </div>
    </footer>
  )
}
