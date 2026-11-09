"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { resetCartProgress } from "./cart-progress"

const ITEMS = [
  { href: "/account", label: "Профиль", short: "Профиль" },
  { href: "/account/orders", label: "Мои заказы", short: "Заказы" },
  { href: "/account/favorites", label: "Избранное", short: "Избранное" },
  { href: "/account/club", label: "Laflamme Club", short: "Club" },
]

/** Меню кабинета: слева на компьютере, вкладками сверху на телефоне. */
export function AccountNav() {
  const path = usePathname()
  const router = useRouter()
  const active = (href: string) => (href === "/account" ? path === "/account" : path.startsWith(href))
  const logout = async () => {
    await fetch("/api/account/logout", { method: "POST" })
    resetCartProgress()
    router.replace("/")
    router.refresh()
  }
  return (
    <>
      <nav aria-label="Личный кабинет" className="md:hidden">
        <ul className="grid grid-cols-4 gap-1.5">
          {ITEMS.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={active(i.href) ? "page" : undefined}
                className={`block rounded-full border py-2.5 text-center text-[13px] transition-colors ${active(i.href) ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground"}`}>
                {i.short}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Личный кабинет" className="hidden md:block">
        <ul className="space-y-1">
          {ITEMS.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={active(i.href) ? "page" : undefined}
                className={`block rounded-xl border-l-2 px-4 py-3 text-[14px] transition-colors ${active(i.href) ? "border-foreground bg-surface" : "border-transparent text-muted hover:text-foreground"}`}>
                {i.label}
              </Link>
            </li>
          ))}
          <li className="pt-6"><button type="button" onClick={logout} className="px-4 py-3 text-[14px] text-muted hover:text-foreground">Выйти</button></li>
        </ul>
      </nav>
    </>
  )
}

/** Кнопка «Выйти» для телефона (внизу профиля). */
export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter()
  return (
    <button type="button" className={className} onClick={async () => {
      await fetch("/api/account/logout", { method: "POST" })
      resetCartProgress()
      router.replace("/")
      router.refresh()
    }}>Выйти</button>
  )
}
