"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { routes } from "@/lib/routes"
import { CloseIcon, MenuIcon } from "./icons"
import type { NavBrand, NavGender } from "./nav-data"

/** Мобильное меню: стеклянная панель на весь экран. */
export function MobileMenu({ nav }: { nav: { genders: NavGender[]; brands: NavBrand[]; saleCount: number } }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(nav.genders[0]?.slug)

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : ""
    return () => { document.documentElement.style.overflow = "" }
  }, [open])

  const close = () => setOpen(false)
  const g = nav.genders.find((x) => x.slug === tab)

  return (
    <>
      <button type="button" aria-label="Меню" aria-expanded={open} onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-black/5">
        <MenuIcon className="size-[22px]" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] p-3" role="dialog" aria-modal="true" aria-label="Меню">
          <div className="absolute inset-0 bg-black/20" onClick={close} />
          <div className="glass-strong relative flex h-full flex-col overflow-y-auto rounded-[28px] p-5">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex gap-2">
                {nav.genders.map((x) => (
                  <button key={x.slug} type="button" onClick={() => setTab(x.slug)}
                    className={`rounded-full px-4 py-2 text-[13px] ${x.slug === tab ? "bg-foreground text-background" : "bg-black/5"}`}>
                    {x.name}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Закрыть" onClick={close} className="rounded-full p-2 hover:bg-black/5"><CloseIcon className="size-6" /></button>
            </div>
            {g && (
              <ul className="space-y-1 text-[22px] leading-tight">
                <li><Link onClick={close} href={routes.newIn(g.slug)} className="block py-1.5">Новинки</Link></li>
                <li><Link onClick={close} href={routes.gender(g.slug)} className="block py-1.5">Всё</Link></li>
                {g.categories.map((c) => (
                  <li key={c.handle}><Link onClick={close} href={routes.category(g.slug, c.handle)} className="block py-1.5">{c.name}</Link></li>
                ))}
                <li><Link onClick={close} href={routes.sale(g.slug)} className="block py-1.5 text-sale">Sale</Link></li>
              </ul>
            )}
            <p className="eyebrow mb-3 mt-8 text-muted">Бренды</p>
            <ul className="grid grid-cols-2 gap-x-4 text-[15px] leading-8">
              {nav.brands.slice(0, 16).map((b) => (
                <li key={b.handle}><Link onClick={close} href={routes.brand(b.handle)}>{b.name}</Link></li>
              ))}
            </ul>
            <Link onClick={close} href={routes.brands()} className="eyebrow mt-4 underline underline-offset-4">Все бренды</Link>
            <div className="mt-auto flex gap-4 pt-8 text-[14px]">
              <Link onClick={close} href={routes.account()}>Личный кабинет</Link>
              <Link onClick={close} href={routes.favorites()}>Избранное</Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
