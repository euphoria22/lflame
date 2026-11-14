"use client"

import { ReactNode, useEffect, useRef } from "react"

import { trackClick, trackImpression, trackVisit } from "@/lib/track"

/**
 * Сетка карточек листинга со сбором событий для умной сортировки: показ (карточка на экране ≥ 50% в течение 1 с)
 * и клик. Карточки — элементы li с data-pid и data-pos. listing = null — события не пишутся (сортировка не по умолчанию, поиск).
 */
export function TrackedGrid({ className, listing, visit = false, children }: { className: string; listing: string | null; visit?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const ul = ref.current
    if (!ul || !listing || typeof IntersectionObserver === "undefined") return
    if (visit) trackVisit(listing)
    const timers = new Map<Element, ReturnType<typeof setTimeout>>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement
        if (e.intersectionRatio >= 0.5) {
          if (!timers.has(el)) timers.set(el, setTimeout(() => {
            timers.delete(el)
            io.unobserve(el)
            if (el.dataset.pid) trackImpression(listing, el.dataset.pid, Number(el.dataset.pos) || 0)
          }, 1000))
        } else {
          const t = timers.get(el)
          if (t) { clearTimeout(t); timers.delete(el) }
        }
      }
    }, { threshold: [0, 0.5] })
    const watched = new WeakSet<Element>()
    const observe = () => ul.querySelectorAll<HTMLElement>(":scope > li[data-pid]").forEach((li) => { if (!watched.has(li)) { watched.add(li); io.observe(li) } })
    observe()
    // «Показать ещё» дорисовывает карточки
    const mo = new MutationObserver(observe)
    mo.observe(ul, { childList: true })
    const onClick = (ev: MouseEvent) => {
      const li = (ev.target as HTMLElement).closest<HTMLElement>("li[data-pid]")
      // Сердечко «в избранное» — не переход в карточку
      if (!li || (ev.target as HTMLElement).closest("[aria-pressed]")) return
      trackClick(listing, li.dataset.pid!, Number(li.dataset.pos) || 0)
    }
    ul.addEventListener("click", onClick)
    return () => {
      io.disconnect()
      mo.disconnect()
      ul.removeEventListener("click", onClick)
      timers.forEach((t) => clearTimeout(t))
    }
  }, [listing, visit])

  return <ul ref={ref} className={className}>{children}</ul>
}
