"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import type { AccountCustomer } from "@/lib/account-types"
import { formatPrice } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { CatalogItem } from "@/lib/types"
import { useFavorites } from "./favorites-context"

const fmtBirth = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("ru-RU") : "—")

/** Профиль: просмотр и «Редактировать» (имя, телефон, дата рождения). Email — адрес входа, не меняется. */
export function ProfileCard({ customer }: { customer: AccountCustomer }) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState({ first_name: customer.first_name ?? "", last_name: customer.last_name ?? "", phone: customer.phone ?? "", birth_date: customer.birth_date ?? "" })
  const [state, setState] = useState<"idle" | "saving" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const field = "h-11 w-full rounded-xl border border-line bg-background px-3 text-[14px] outline-none focus:border-foreground"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setState("saving")
    setError(null)
    const r = await fetch("/api/account/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...v, birth_date: v.birth_date || null }) })
    if (!r.ok) {
      setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Не сохранилось")
      setState("error")
      return
    }
    setState("idle")
    setEdit(false)
    router.refresh()
  }

  const rows: [string, string][] = [
    ["Имя", [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—"],
    ["E-mail", customer.email],
    ["Телефон", customer.phone || "—"],
    ["Дата рождения", fmtBirth(customer.birth_date)],
  ]

  return (
    <section className="rounded-[24px] border border-line bg-background p-5 md:p-8">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-[22px] tracking-tight md:text-[26px]">Профиль</h2>
        {!edit && <button type="button" onClick={() => setEdit(true)} className="text-[13px] underline underline-offset-4 hover:opacity-60">Редактировать →</button>}
      </div>
      {!edit ? (
        <dl className="divide-y divide-line">
          {rows.map(([k, val]) => (
            <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 py-3 text-[14px] md:grid-cols-[200px_minmax(0,1fr)]">
              <dt className="text-muted">{k}</dt><dd className="break-words">{val}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <form onSubmit={save} className="grid gap-3 md:max-w-xl md:grid-cols-2">
          <input className={field} placeholder="Имя" autoComplete="given-name" value={v.first_name} onChange={(e) => setV({ ...v, first_name: e.target.value })} />
          <input className={field} placeholder="Фамилия" autoComplete="family-name" value={v.last_name} onChange={(e) => setV({ ...v, last_name: e.target.value })} />
          <input className={field} placeholder="Телефон" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          <label className="block">
            <span className="sr-only">Дата рождения</span>
            <input className={field} type="date" aria-label="Дата рождения" value={v.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setV({ ...v, birth_date: e.target.value })} />
          </label>
          <p className="text-[12px] text-muted md:col-span-2">Email — адрес входа: {customer.email}. Телефон нужен для Laflamme Club — по нему мы находим покупки в магазине.</p>
          {error && <p className="text-[12px] text-sale md:col-span-2" role="alert">{error}</p>}
          <div className="flex gap-2 md:col-span-2">
            <button disabled={state === "saving"} className="h-11 rounded-full bg-foreground px-6 text-[14px] text-background disabled:opacity-60">{state === "saving" ? "Сохраняем…" : "Сохранить"}</button>
            <button type="button" onClick={() => setEdit(false)} className="h-11 rounded-full border border-line px-6 text-[14px] hover:border-foreground">Отмена</button>
          </div>
        </form>
      )}
    </section>
  )
}

/** Избранное в профиле: первые 3 товара. */
export function FavoritesPreview() {
  const fav = useFavorites()
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const key = fav.list.slice(0, 6).join(",")
  useEffect(() => {
    if (!fav.ready) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- пустой список без запроса
    if (!key) { setItems([]); return }
    let alive = true
    fetch(`/api/favorites/items?h=${encodeURIComponent(key)}`).then((r) => r.json()).then((d: { items: CatalogItem[] }) => { if (alive) setItems(d.items) }).catch(() => alive && setItems([]))
    return () => { alive = false }
  }, [key, fav.ready])
  const shown = (items ?? []).slice(0, 3)
  return (
    <section className="rounded-[24px] border border-line bg-background p-5 md:p-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-[22px] tracking-tight md:text-[26px]">Избранное</h2>
        {!!fav.list.length && <Link href="/account/favorites" className="text-[13px] underline underline-offset-4 hover:opacity-60">Все товары ({fav.list.length}) →</Link>}
      </div>
      {items !== null && !shown.length ? (
        <p className="text-[14px] text-muted">Пока пусто — нажмите ♡ на товаре, чтобы сохранить его.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((i) => (
            <li key={i.handle}>
              <Link href={routes.product(i.handle)} className="group flex items-center gap-4 py-3">
                <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="64px" className="blend object-contain" />}</span>
                <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-[14px]">{i.title}</span><span className="mt-1 block text-[14px]">{formatPrice(i.price)}</span></span>
                <span aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
