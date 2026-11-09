import { cacheTag } from "next/cache"
import Image from "next/image"
import Link from "next/link"

import { routes } from "@/lib/routes"
import { CartButton } from "./cart-button"
import { FavLink } from "./fav-button"
import { SearchIcon, UserIcon } from "./icons"
import { Logo } from "./logo"
import { MobileMenu } from "./mobile-menu"
import { getNav, type NavTile } from "./nav-data"

/**
 * Шапка: плавающая «стеклянная» капсула. Меню — серверный HTML со ссылками,
 * доступно без JavaScript (ТЗ, п. 7.12); выпадающие панели открываются по наведению и фокусу.
 */
/**
 * Выпадающая панель: начинается сразу под шапкой (pt-2 — невидимый «мостик»),
 * поэтому при переводе курсора вниз меню не пропадает. Скрывается с небольшой задержкой.
 */
const PANEL = "pointer-events-none invisible absolute inset-x-0 top-full pt-2 opacity-0 transition-[opacity,visibility] delay-150 duration-200 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-focus-within:delay-0 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-hover:delay-0"

/** Плитка с фото в меню (как у Brandshop): фото 3:4 и подпись капслоком. */
function MenuTile({ tile }: { tile: NavTile }) {
  return (
    <Link href={tile.href} className="group/tile block w-[240px] min-w-0 shrink">
      <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-surface">
        {tile.image && <Image src={tile.image} alt={tile.label} fill sizes="260px" className="object-cover transition-transform duration-500 group-hover/tile:scale-[1.04]" />}
      </span>
      <span className="eyebrow mt-2 block text-center">{tile.label}</span>
    </Link>
  )
}

export async function Header() {
  "use cache"
  cacheTag("catalog", "menu")
  const nav = await getNav()
  const link = "px-3 py-2 text-[13px] hover:opacity-60 transition-opacity"

  return (
    <header className="fixed inset-x-0 top-[var(--bar-offset,var(--bar,0px))] z-50 px-3 pt-3 transition-[top] duration-300 md:px-4">
      <div className="relative mx-auto flex h-14 max-w-[1680px] items-center justify-between px-3 md:px-5">
        {/* Стекло — отдельным слоем: иначе у вложенных панелей не работает размытие фона */}
        <div aria-hidden className="glass pointer-events-none absolute inset-0 -z-10 rounded-full" />
        <div className="flex items-center md:hidden">
          <MobileMenu nav={nav} />
        </div>

        <nav aria-label="Основное меню" className="hidden md:block">
          <ul className="flex items-center">
            <li className="flex h-14 items-center"><Link href={routes.newIn()} className={link}>Новинки</Link></li>
            <li className="group flex h-14 items-center">
              <Link href={routes.brands()} className={link}>Бренды</Link>
              <div className={PANEL}>
                <div className="glass-strong grid grid-cols-[1fr_auto] gap-10 rounded-[28px] p-8">
                  <div>
                    <Link href={routes.brands()} className="eyebrow mb-5 inline-block text-muted hover:text-foreground">Все бренды</Link>
                    <ul className="columns-4 gap-8 text-[14px] leading-8">
                      {nav.brands.map((b) => (
                        <li key={b.handle} className="break-inside-avoid"><Link href={routes.brand(b.handle)} className="hover:opacity-60">{b.name}</Link></li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex w-[440px] justify-end gap-4">{nav.brandTiles.map((t) => <MenuTile key={t.href} tile={t} />)}</div>
                </div>
              </div>
            </li>
            {nav.genders.map((g) => (
              <li key={g.slug} className="group flex h-14 items-center">
                <Link href={routes.gender(g.slug)} className={link}>{g.name}</Link>
                <div className={PANEL}>
                  <div className="glass-strong grid w-fit max-w-full grid-cols-[minmax(0,200px)_minmax(0,240px)_auto] gap-10 rounded-[28px] p-8">
                    <div>
                      <Link href={routes.brands()} className="eyebrow mb-5 inline-block text-muted hover:text-foreground">Все бренды</Link>
                      <ul className="text-[14px] leading-8">
                        {g.brands.map((b) => (
                          <li key={b.handle}><Link href={routes.brandGender(b.handle, g.slug)} className="hover:opacity-60">{b.name}</Link></li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <Link href={routes.gender(g.slug)} className="eyebrow mb-5 inline-block text-muted hover:text-foreground">Все категории</Link>
                      <ul className="text-[14px] leading-8">
                        {g.categories.map((c) => (
                          <li key={c.handle}><Link href={routes.category(g.slug, c.handle)} className="hover:opacity-60">{c.name}</Link></li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-start gap-4">{g.tiles.map((t) => <MenuTile key={t.href} tile={t} />)}</div>
                  </div>
                </div>
              </li>
            ))}
            {nav.saleCount > 0 && <li className="flex h-14 items-center"><Link href={routes.sale()} className={`${link} text-sale`}>Sale</Link></li>}
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
