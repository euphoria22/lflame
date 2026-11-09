"use client"

import { useEffect, useState } from "react"

/**
 * Плавное появление и исчезание панелей: пока идёт анимация закрытия, панель ещё в DOM.
 * mounted — рисовать ли панель; state — значение для data-state ("open" | "closed").
 */
export function usePresence(open: boolean, exitMs = 240): { mounted: boolean; state: "open" | "closed" } {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- монтирование панели при открытии
      setMounted(true)
      return
    }
    const t = setTimeout(() => setMounted(false), exitMs)
    return () => clearTimeout(t)
  }, [open, exitMs])
  return { mounted: open || mounted, state: open ? "open" : "closed" }
}
