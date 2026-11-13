import { cacheTag } from "next/cache"
import Image from "next/image"
import Link from "next/link"

import { routes } from "@/lib/routes"
import { CartButton } from "./cart-button"
import { FavLink } from "./fav-button"
import { SearchIcon, UserIcon } from "./icons"
import { Logo } from "./logo"
import { MegaItem, MegaLink, MegaMenu } from "./mega-menu"
import { MobileMenu } from "./mobile-menu"
import { getNav, type NavTile } from "./nav-data"

/**
 * Шапка: плавающая «стеклянная» капсула. Меню — серверный HTML со ссылками,
 * доступно без JavaScript (ТЗ, п. 7.12); выпадающие панели открываются по наведению и фокусу.
 */
/** Плитка с фото в меню (как у Brandshop): фото 3:4 и подпись капслоком. */
function MenuTile({ tile }: { tile: NavTile }) {
  return (
    <Link href={tile.href} className="group/tile block min-w-0 max-w-[240px] flex-1">
      <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-surface">
        {/* Фото меню грузятся заранее — при открытии панели ничего не «проявляется» */}
        {tile.image && <Image src={tile.image} alt={tile.label} fill sizes="240px" loading="eager" fetchPriority="low" className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/tile:scale-[1.03]" />}
      </span>
      <span className="eyebrow mt-2 block text-center">{tile.label}</span>
    </Link>
  )
}

export async function Header() {
  "use cache"
  cacheTag("catalog", "menu")
  return <HeaderView nav={await getNav()} />
}

/** Сама шапка по данным меню (отдельно от загрузки — для превью без бэкенда). */
export function HeaderView({ nav }: { nav: Awaited<ReturnType<typeof getNav>> }) {
  const link = "px-3 py-2 text-[13px] hover:opacity-60 group-data-[open=true]:opacity-60 transition-opacity"

  return (
    <header className="fixed inset-x-0 top-[var(--bar-offset,var(--bar,0px))] z-50 px-3 pt-3 transition-[top] duration-300 md:px-4">
      <div className="relative mx-auto flex h-14 max-w-[1680px] items-center justify-between px-3 md:px-5">
        {/* Стекло — отдельным слоем: иначе у вложенных панелей не работает размытие фона */}
        <div aria-hidden className="glass pointer-events-none absolute inset-0 -z-10 rounded-full" />
        <div className="flex items-center md:hidden">
          <MobileMenu nav={nav} />
        </div>

        <nav aria-label="Основное меню" className="hidden md:block">
          <MegaMenu>
            <MegaLink><Link href={routes.newIn()} className={link}>Новинки</Link></MegaLink>
            <MegaItem id="brands" trigger={<Link href={routes.brands()} className={link}>Бренды</Link>}>
                <div className="glass-strong grid grid-cols-[1fr_auto] gap-10 rounded-[28px] p-8">
                  <div>
                    <Link href={routes.brands()} className="eyebrow mb-5 inline-block text-muted hover:text-foreground">Все бренды</Link>
                    <ul className="columns-4 gap-8 text-[14px] leading-8">
                      {nav.brands.map((b) => (
                        <li key={b.handle} className="break-inside-avoid"><Link href={routes.brand(b.handle)} className="hover:opacity-60">{b.name}</Link></li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex w-[clamp(300px,28vw,480px)] justify-end gap-4">{nav.brandTiles.map((t) => <MenuTile key={t.href} tile={t} />)}</div>
                </div>
            </MegaItem>
            {nav.genders.map((g) => (
              <MegaItem key={g.slug} id={g.slug} trigger={<Link href={routes.gender(g.slug)} className={link}>{g.name}</Link>}>
                  <div className="glass-strong grid grid-cols-[auto_auto_minmax(0,752px)] justify-between gap-12 rounded-[28px] p-8">
                    <div>
                      <Link href={routes.brands()} className="eyebrow mb-5 inline-block text-muted hover:text-foreground">Все бренды</Link>
                      <ul className="columns-2 gap-12 text-[15px] leading-9">
                        {g.brands.map((b) => (
                          <li key={b.handle} className="break-inside-avoid whitespace-nowrap"><Link href={routes.brandGender(b.handle, g.slug)} className="hover:opacity-60">{b.name}</Link></li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <Link href={routes.gender(g.slug)} className="eyebrow mb-5 inline-block text-muted hover:text-foreground">Все категории</Link>
                      <ul className="columns-2 gap-12 text-[15px] leading-9">
                        {g.categories.map((c) => (
                          <li key={c.handle} className="break-inside-avoid whitespace-nowrap"><Link href={routes.category(g.slug, c.handle)} className="hover:opacity-60">{c.name}</Link></li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-start justify-end gap-4">{g.tiles.map((t) => <MenuTile key={t.href} tile={t} />)}</div>
                  </div>
              </MegaItem>
            ))}
            {nav.outletCount > 0 && <MegaLink><Link href={routes.outlet()} className={`${link} text-sale`}>Outlet</Link></MegaLink>}
          </MegaMenu>
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
