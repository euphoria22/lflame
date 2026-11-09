"use client"

import { HeartIcon } from "./icons"
import { useFavorites } from "./favorites-context"

/** Сердечко «В избранное» на карточке и странице товара. */
export function FavButton({ handle, title, className = "" }: { handle: string; title: string; className?: string }) {
  const fav = useFavorites()
  const on = fav.has(handle)
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); fav.toggle(handle) }}
      aria-pressed={on} aria-label={on ? `Убрать из избранного: ${title}` : `В избранное: ${title}`}
      className={`grid place-items-center rounded-full transition-transform active:scale-90 ${className}`}>
      <HeartIcon className={`size-[20px] ${on ? "fill-current text-foreground" : ""}`} />
    </button>
  )
}

/** Сердечко в шапке со счётчиком. */
export function FavLink({ className = "" }: { className?: string }) {
  const fav = useFavorites()
  return (
    <span className={`relative ${className}`}>
      <HeartIcon className={`size-[22px] ${fav.list.length ? "fill-current" : ""}`} />
      {fav.list.length > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[10px] text-background">{fav.list.length}</span>
      )}
    </span>
  )
}
