"use client"

import Image from "next/image"
import { useRef, useState } from "react"

/**
 * Галерея карточки товара. Десктоп — фото вертикально, крупно, без горизонтальной прокрутки.
 * Телефон — листание свайпом с точками.
 */
export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0)
  const rail = useRef<HTMLDivElement>(null)

  if (!images.length) {
    return <div className="aspect-[3/4] bg-surface" />
  }

  const onScroll = () => {
    const el = rail.current
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <>
      {/* Телефон */}
      <div className="relative md:hidden">
        <div ref={rail} onScroll={onScroll} className="rail flex overflow-x-auto">
          {images.map((src, i) => (
            <div key={src} className="relative aspect-[3/4] w-full shrink-0 bg-surface">
              <Image src={src} alt={`${title} — фото ${i + 1}`} fill priority={i === 0} sizes="100vw" className="blend object-contain" />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="glass absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full px-3 py-2">
            {images.map((src, i) => (
              <span key={src} className={`size-1.5 rounded-full transition-colors ${i === active ? "bg-foreground" : "bg-foreground/25"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Десктоп */}
      <div className={`hidden gap-px bg-line md:grid ${images.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {images.map((src, i) => (
          <div key={src} className={`relative aspect-[3/4] bg-surface ${i === 0 && images.length > 2 ? "xl:col-span-2 xl:aspect-[4/3]" : ""}`}>
            <Image src={src} alt={`${title} — фото ${i + 1}`} fill priority={i === 0}
              sizes={i === 0 ? "(min-width: 1280px) 70vw, 60vw" : "(min-width: 1280px) 35vw, 60vw"}
              className="blend object-contain" />
          </div>
        ))}
      </div>
    </>
  )
}
