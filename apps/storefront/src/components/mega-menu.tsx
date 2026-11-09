"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"

type Mega = { open: string | null; instant: boolean; enter: (id: string) => void; close: (delayed: boolean) => void }
const Ctx = createContext<Mega | null>(null)

/**
 * Выпадающее меню шапки. Первое открытие — мягкое проявление, переключение между пунктами — мгновенное
 * (без мигания двух полупрозрачных панелей), закрытие — плавное и с небольшой задержкой,
 * чтобы меню не пропадало, если курсор чуть вышел за край.
 */
export function MegaMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null)
  const [instant, setInstant] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openRef = useRef<string | null>(null)

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  const enter = useCallback((id: string) => {
    clear()
    setInstant(openRef.current !== null && openRef.current !== id)
    openRef.current = id
    setOpen(id)
  }, [])
  const close = useCallback((delayed: boolean) => {
    clear()
    const run = () => { setInstant(false); openRef.current = null; setOpen(null) }
    if (delayed) timer.current = setTimeout(run, 160)
    else run()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false) }
    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("keydown", onKey); clear() }
  }, [close])

  return (
    <Ctx.Provider value={{ open, instant, enter, close }}>
      <ul className="flex items-center" onMouseLeave={() => close(true)}>{children}</ul>
    </Ctx.Provider>
  )
}

/** Пункт с выпадающей панелью. */
export function MegaItem({ id, trigger, children }: { id: string; trigger: ReactNode; children: ReactNode }) {
  const m = useContext(Ctx)!
  const isOpen = m.open === id
  return (
    <li className="group flex h-14 items-center" data-open={isOpen}
      onMouseEnter={() => m.enter(id)}
      onFocus={() => m.enter(id)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) m.close(true) }}>
      {trigger}
      <div className="mega absolute inset-x-0 top-full pt-2" data-open={isOpen} data-instant={m.instant}>{children}</div>
    </li>
  )
}

/** Пункт без панели: наведение на него сразу закрывает открытую панель. */
export function MegaLink({ children }: { children: ReactNode }) {
  const m = useContext(Ctx)!
  return <li className="flex h-14 items-center" onMouseEnter={() => m.close(false)}>{children}</li>
}
