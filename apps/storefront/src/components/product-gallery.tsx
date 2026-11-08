"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

import { CloseIcon } from "./icons"

/**
 * Галерея карточки товара (обратная связь 08.11.2026):
 * - каждое фото помещается в экран по высоте, без огромного первого кадра;
 * - одно фото — по центру; несколько — по два в ряд, одинакового размера;
 * - по клику — просмотр во весь экран с увеличением (клик или движение мыши).
 * На телефоне — листание свайпом.
 */
export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0)
  const [viewer, setViewer] = useState<number | null>(null)
  const rail = useRef<HTMLDivElement>(null)

  if (!images.length) {
    return <div className="aspect-[3/4] bg-surface" />
  }

  const onScroll = () => {
    const el = rail.current
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth))
  }
  const single = images.length === 1

  return (
    <>
      {/* Телефон */}
      <div className="relative md:hidden">
        <div ref={rail} onScroll={onScroll} className="rail flex overflow-x-auto">
          {images.map((src, i) => (
            <button key={src} type="button" onClick={() => setViewer(i)} aria-label={`Увеличить фото ${i + 1}`}
              className="relative aspect-[3/4] w-full shrink-0 bg-surface">
              <Image src={src} alt={`${title} — фото ${i + 1}`} fill priority={i === 0} sizes="100vw" className="blend object-contain" />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((src, i) => (
              <span key={src} className={`size-1.5 rounded-full transition-colors ${i === active ? "bg-foreground" : "bg-foreground/25"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Десктоп: высота кадра не больше экрана за вычетом шапки */}
      <div className={`hidden gap-px bg-line md:grid ${single ? "" : "lg:grid-cols-2"}`}>
        {images.map((src, i) => (
          <button key={src} type="button" onClick={() => setViewer(i)} aria-label={`Увеличить фото ${i + 1}`}
            className={`relative cursor-zoom-in bg-surface ${single ? "h-[calc(100vh-84px)] max-h-[1100px] min-h-[480px]" : "aspect-[3/4] max-h-[calc(100vh-84px)]"}`}>
            <Image src={src} alt={`${title} — фото ${i + 1}`} fill priority={i < 2}
              sizes={single ? "(min-width: 768px) 65vw, 100vw" : "(min-width: 1024px) 33vw, 65vw"}
              className="blend object-contain" />
          </button>
        ))}
      </div>

      {viewer !== null && <Viewer images={images} title={title} start={viewer} onClose={() => setViewer(null)} />}
    </>
  )
}

/** Просмотр во весь экран: стрелки, Esc, увеличение по клику с панорамированием за курсором. */
function Viewer({ images, title, start, onClose }: { images: string[]; title: string; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start)
  const [zoom, setZoom] = useState(false)
  const [origin, setOrigin] = useState("50% 50%")

  const go = useCallback((d: number) => {
    setZoom(false)
    setIndex((i) => (i + d + images.length) % images.length)
  }, [images.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    document.documentElement.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.documentElement.style.overflow = ""
    }
  }, [go, onClose])

  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }

  return (
    <div className="fixed inset-0 z-[70] bg-background" role="dialog" aria-modal="true" aria-label={`${title} — фото`}>
      <div className={`relative h-full w-full overflow-hidden ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
        onClick={() => setZoom((z) => !z)} onMouseMove={move}>
        <Image src={images[index]} alt={`${title} — фото ${index + 1}`} fill sizes="100vw" quality={85}
          className="blend object-contain transition-transform duration-300 ease-out"
          style={{ transform: zoom ? "scale(2.2)" : "scale(1)", transformOrigin: origin }} />
      </div>
      <button type="button" onClick={onClose} aria-label="Закрыть" className="glass absolute right-4 top-4 rounded-full p-3"><CloseIcon className="size-6" /></button>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Предыдущее фото" className="glass absolute left-4 top-1/2 -translate-y-1/2 rounded-full px-4 py-3 text-[18px]">←</button>
          <button type="button" onClick={() => go(1)} aria-label="Следующее фото" className="glass absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-4 py-3 text-[18px]">→</button>
          <p className="glass absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-[13px]">{index + 1} / {images.length}</p>
        </>
      )}
    </div>
  )
}
