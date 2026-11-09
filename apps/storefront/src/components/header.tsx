import { cacheTag } from "next/cache"
import Link from "next/link"

import { routes } from "@/lib/routes"
import { CartButton } from "./cart-button"
import { FavLink } from "./fav-button"
import { SearchIcon, UserIcon } from "./icons"
import { Logo } from "./logo"
import { MobileMenu } from "./mobile-menu"
import { getNav } from "./nav-data"

/**
 * Шапка: плавающая «стеклянная» капсула. Меню — серверный HTML со ссылками,
 * доступно без JavaScript (ТЗ, п. 7.12); выпадающие панели открываются по наведению и фокусу.
 */
export async function Header() {
  "use cache"
  cacheTag("catalog")
  const nav = await getNav()
  const link = "px-3 py-2 text-[13px] hover:opacity-60 transition-opacity"

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-4">
      <div className="glass relative mx-auto flex h-14 max-w-[1680px] items-center justify-between rounded-full px-3 md:px-5">
        <div className="flex items-center md:hidden">
          <MobileMenu nav={nav} />
        </div>

        <nav aria-label="Основное меню" className="hidden md:block">
          <ul className="flex items-center">
            <li><Link href={routes.newIn()} className={link}>Новинки</Link></li>
            <li className="group">
              <Link href={routes.brands()} className={link}>Бренды</Link>
              <div className="pointer-events-none invisible absolute inset-x-0 top-[calc(100%+8px)] opacity-0 transition-all duration-200 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                <div className="glass-strong rounded-[28px] p-8">
                  <p className="eyebrow mb-5 text-muted">Бренды</p>
                  <ul className="columns-4 gap-8 text-[14px] leading-8">
                    {nav.brands.map((b) => (
                      <li key={b.handle}><Link href={routes.brand(b.handle)} className="hover:opacity-60">{b.name}</Link></li>
                    ))}
                  </ul>
                  <Link href={routes.brands()} className="eyebrow mt-6 inline-block underline underline-offset-4">Все бренды</Link>
                </div>
              </div>
            </li>
            {nav.genders.map((g) => (
              <li key={g.slug} className="group">
                <Link href={routes.gender(g.slug)} className={link}>{g.name}</Link>
                <div className="pointer-events-none invisible absolute inset-x-0 top-[calc(100%+8px)] opacity-0 transition-all duration-200 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                  <div className="glass-strong grid grid-cols-[1fr_1fr_280px] gap-10 rounded-[28px] p-8">
                    <div>
                      <p className="eyebrow mb-5 text-muted">Категории</p>
                      <ul className="columns-2 gap-8 text-[14px] leading-8">
                        <li><Link href={routes.gender(g.slug)} className="font-medium hover:opacity-60">Всё</Link></li>
                        {g.categories.map((c) => (
                          <li key={c.handle}><Link href={routes.category(g.slug, c.handle)} className="hover:opacity-60">{c.name}</Link></li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="eyebrow mb-5 text-muted">Популярные бренды</p>
                      <ul className="columns-2 gap-8 text-[14px] leading-8">
                        {g.brands.map((b) => (
                          <li key={b.handle}><Link href={routes.brandGender(b.handle, g.slug)} className="hover:opacity-60">{b.name}</Link></li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-3">
                      <Link href={routes.newIn(g.slug)} className="flex flex-1 items-end rounded-2xl bg-surface p-5 text-[15px] hover:bg-surface-2">Новинки →</Link>
                      <Link href={routes.sale(g.slug)} className="flex flex-1 items-end rounded-2xl bg-foreground p-5 text-[15px] text-background hover:opacity-90">Sale →</Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {nav.saleCount > 0 && <li><Link href={routes.sale()} className={`${link} text-sale`}>Sale</Link></li>}
            <li><Link href={routes.blog()} className={link}>Блог</Link></li>
          </ul>
        </nav>

        <Logo className="absolute left-1/2 -translate-x-1/2" />

        <div className="flex items-center gap-1">
          <Link href={routes.search()} aria-label="Поиск" className="rounded-full p-2 hover:bg-black/5"><SearchIcon className="size-[22px]" /></Link>
          <Link href={routes.favorites()} aria-label="Избранное" className="hidden rounded-full p-2 hover:bg-black/5 md:block"><FavLink /></Link>
          <Link href={routes.account()} aria-label="Личный кабинет" className="hidden rounded-full p-2 hover:bg-black/5 md:block"><UserIcon className="size-[22px]" /></Link>
          <CartButton />
        </div>
      </div>
    </header>
  )
}
