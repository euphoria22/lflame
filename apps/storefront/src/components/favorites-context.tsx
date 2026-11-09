"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

type FavState = { list: string[]; ready: boolean; has: (handle: string) => boolean; toggle: (handle: string) => void; sync: () => Promise<void> }

const Ctx = createContext<FavState | null>(null)
const KEY = "lf_favorites"

function readLocal(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 300) : []
  } catch {
    return []
  }
}
function writeLocal(list: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* приватный режим */ }
}

/**
 * Избранное (ТЗ, п. 6.5): хранится в браузере; у вошедшего покупателя — ещё и в аккаунте.
 * После входа список с этого устройства объединяется с сохранённым в аккаунте.
 */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const logged = useRef(false)

  /** Сверка с аккаунтом: объединяем список этого устройства с сохранённым в аккаунте. */
  const sync = useCallback(async () => {
    const local = readLocal()
    try {
      const d = (await (await fetch("/api/favorites")).json()) as { logged: boolean; favorites: string[] }
      logged.current = d.logged
      if (!d.logged) return
      const merged = [...new Set([...d.favorites, ...local])].slice(0, 300)
      setList(merged)
      writeLocal(merged)
      if (merged.length !== d.favorites.length) {
        await fetch("/api/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorites: merged }) })
      }
    } catch {
      // без связи — остаётся список этого устройства
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage доступен только в браузере
    setList(readLocal())
    sync().finally(() => setReady(true))
  }, [sync])

  const toggle = useCallback((handle: string) => {
    setList((cur) => {
      const next = cur.includes(handle) ? cur.filter((h) => h !== handle) : [handle, ...cur].slice(0, 300)
      writeLocal(next)
      if (logged.current) {
        fetch("/api/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorites: next }) }).catch(() => null)
      }
      return next
    })
  }, [])

  const has = useCallback((h: string) => list.includes(h), [list])
  return <Ctx.Provider value={{ list, ready, has, toggle, sync }}>{children}</Ctx.Provider>
}

export function useFavorites(): FavState {
  const v = useContext(Ctx)
  if (!v) throw new Error("useFavorites вне FavoritesProvider")
  return v
}
