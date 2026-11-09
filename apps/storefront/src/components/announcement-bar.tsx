"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import type { Announcement } from "@/lib/blog"

const THEMES = {
  dark: "bg-foreground text-background",
  sale: "bg-sale text-white",
  light: "bg-surface text-foreground",
}

/**
 * Полоска с акциями над шапкой (текст — в CMS, «Плашка с акциями»).
 * Сообщения сменяются каждые 5 секунд. При прокрутке полоска уезжает вверх, а шапка поднимается.
 */
export function AnnouncementBar({ data }: { data: Announcement }) {
  const [i, setI] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (data.items.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % data.items.length), 5000)
    return () => clearInterval(t)
  }, [data.items.length])

  useEffect(() => {
    const onScroll = () => {
      const h = window.scrollY > 8
      setHidden(h)
      document.documentElement.style.setProperty("--bar-offset", h ? "0px" : "var(--bar)")
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div role="region" aria-label="Акции" aria-hidden={hidden}
      className={`fixed inset-x-0 top-0 z-[51] flex h-[var(--bar)] items-center justify-center overflow-hidden px-4 transition-transform duration-300 ${THEMES[data.theme]} ${hidden ? "-translate-y-full" : ""}`}>
      {data.items.map((m, n) => (
        <p key={n} aria-live={n === i ? "polite" : "off"}
          className={`absolute inset-x-4 truncate text-center text-[11px] tracking-[0.02em] md:text-[12px] transition-all duration-500 ${n === i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
          {m.text}
          {m.link && (
            <>
              {" · "}
              <Link href={m.link} tabIndex={n === i && !hidden ? 0 : -1} className="underline underline-offset-4">{m.linkLabel || "Подробнее"}</Link>
            </>
          )}
        </p>
      ))}
    </div>
  )
}
