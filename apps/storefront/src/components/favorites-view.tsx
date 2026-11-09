"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { routes } from "@/lib/routes"
import type { CatalogItem } from "@/lib/types"
import { useFavorites } from "./favorites-context"
import { ProductCard } from "./product-card"

const GRID = "grid-lines grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
const CELL3 = "[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0"
const CELL = "[&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(3n)]:border-r-0 xl:[&:nth-child(3n)]:border-r xl:[&:nth-child(4n)]:border-r-0"

/** Страница «Избранное»: товары из списка в браузере / аккаунте. */
/** embedded — внутри личного кабинета: заголовок кабинета, сетка без выхода за поля. */
export function FavoritesView({ embedded = false }: { embedded?: boolean }) {
  const fav = useFavorites()
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const key = fav.list.join(",")

  useEffect(() => {
    if (!fav.ready) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- пустой список без запроса
    if (!key) { setItems([]); return }
    let cancelled = false
    fetch(`/api/favorites/items?h=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d: { items: CatalogItem[] }) => { if (!cancelled) setItems(d.items) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [key, fav.ready])

  // Удалённое из избранного прячем сразу, без нового запроса
  const shown = (items ?? []).filter((i) => fav.has(i.handle))

  return (
    <div className={embedded ? "" : "pb-24 pt-6"}>
      <div className={embedded ? "" : "px-4 md:px-8"}>
        <h1 className="text-[28px] tracking-tight md:text-[40px]">Избранное</h1>
        {items !== null && shown.length > 0 && <p className="mt-2 text-[14px] text-muted">Сохраняется на этом устройстве, а после входа — в вашем аккаунте.</p>}
      </div>
      {items === null ? (
        <p className="px-4 py-16 text-[14px] text-muted md:px-8">Загружаем…</p>
      ) : !shown.length ? (
        <div className="px-4 py-20 text-center">
          <p className="text-[17px]">Здесь пока пусто</p>
          <p className="mt-2 text-[14px] text-muted">Нажмите на сердечко у товара, чтобы сохранить его.</p>
          <Link href={routes.newIn()} className="mt-6 inline-block rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Смотреть новинки</Link>
        </div>
      ) : (
        <ul className={embedded ? "grid-lines mt-6 grid grid-cols-2 overflow-hidden rounded-[24px] border border-line lg:grid-cols-3" : `${GRID} mt-8`}>
          {shown.map((item) => <li key={item.id} className={embedded ? CELL3 : CELL}><ProductCard item={item} /></li>)}
        </ul>
      )}
    </div>
  )
}
