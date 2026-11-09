"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { YM_ID } from "@/lib/analytics"

const KEY = "lf_cookie_consent"
type Choice = "all" | "necessary"
type W = Window & { ym?: ((...a: unknown[]) => void) & { a?: unknown[]; l?: number } }

const read = (): Choice | null => {
  try { return (localStorage.getItem(KEY) as Choice | null) } catch { return null }
}

/** Загрузка счётчика Метрики (официальный код), только после согласия. */
function loadMetrika() {
  const w = window as W
  if (!YM_ID || w.ym) return
  const ym = function (...args: unknown[]) { (ym.a = ym.a || []).push(args) } as NonNullable<W["ym"]>
  ym.l = Date.now()
  w.ym = ym
  const s = document.createElement("script")
  s.async = true
  s.src = "https://mc.yandex.ru/metrika/tag.js"
  document.head.appendChild(s)
  ym(YM_ID, "init", { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, ecommerce: "dataLayer" })
}

/**
 * Баннер cookie (ТЗ, п. 8.7): аналитика — только после согласия.
 * «Только необходимые» — сайт работает как обычно (корзина, вход), но без Метрики.
 */
export function CookieConsent() {
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined)
  const path = usePathname()
  const search = useSearchParams()
  const first = useRef(true)

  useEffect(() => {
    const c = read()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- выбор хранится только в браузере
    setChoice(c)
    if (c === "all") loadMetrika()
  }, [])

  // Переходы между страницами без перезагрузки — отдельный просмотр в Метрике
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const w = window as W
    if (YM_ID && w.ym) w.ym(YM_ID, "hit", window.location.href, { referer: document.referrer })
  }, [path, search])

  const decide = (c: Choice) => {
    try { localStorage.setItem(KEY, c) } catch { /* приватный режим */ }
    setChoice(c)
    if (c === "all") {
      loadMetrika()
      const w = window as W
      if (YM_ID && w.ym) w.ym(YM_ID, "hit", window.location.href)
    }
  }

  if (choice !== null) return null
  return (
    <div role="dialog" aria-label="Cookie" className="glass-strong fixed inset-x-2 bottom-2 z-[55] mx-auto max-w-3xl rounded-[24px] p-4 md:bottom-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <p className="flex-1 text-[13px] leading-relaxed">
          Мы используем cookie: необходимые — чтобы работали корзина и вход, и аналитические (Яндекс Метрика) — чтобы делать сайт удобнее.
          Подробнее — в <Link href="/privacy" className="underline underline-offset-4">политике обработки данных</Link>.
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => decide("necessary")} className="h-10 rounded-full border border-line bg-background px-4 text-[13px] hover:border-foreground">Только необходимые</button>
          <button type="button" onClick={() => decide("all")} className="h-10 rounded-full bg-foreground px-5 text-[13px] text-background">Принять</button>
        </div>
      </div>
    </div>
  )
}
