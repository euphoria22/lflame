"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Видео баннера на главной. Первым на экране появляется обложка-фото (она лёгкая и быстро грузится),
 * а видео (несколько мегабайт) начинает качаться только после загрузки страницы, когда браузер свободен.
 * При экономии трафика или медленной сети видео не грузим вовсе — остаётся фото.
 */
export function HeroVideo({ src, type, className }: { src: string; type: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [on, setOn] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (c?.saveData || /(^|-)2g|3g/.test(c?.effectiveType ?? "")) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let t: ReturnType<typeof setTimeout> | undefined
    const start = () => { t = setTimeout(() => setOn(true), 1200) }
    if (document.readyState === "complete") start()
    else window.addEventListener("load", start, { once: true })
    return () => { window.removeEventListener("load", start); if (t) clearTimeout(t) }
  }, [])

  if (!on) return null
  return (
    <video ref={ref} className={`${className} transition-opacity duration-700 ${shown ? "opacity-100" : "opacity-0"}`}
      autoPlay muted loop playsInline preload="auto" aria-hidden onPlaying={() => setShown(true)}>
      <source src={src} type={type} />
    </video>
  )
}
