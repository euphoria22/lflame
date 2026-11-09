"use client"

import { useEffect, useState } from "react"

let meReq: Promise<string> | null = null
/** Email вошедшего покупателя — чтобы не вводить его заново. */
const myEmail = () => (meReq ??= fetch("/api/account/me").then((r) => (r.ok ? r.json() : null)).then((d: { customer?: { email?: string } } | null) => d?.customer?.email ?? "").catch(() => ""))

/** «Сообщить о поступлении» для закончившегося размера (ТЗ, п. 6.3). */
export function RestockForm({ variantId, size }: { variantId: string; size: string }) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    myEmail().then((e) => { if (alive && e) setEmail((cur) => cur || e) })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    // Другой размер — новая подписка
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене размера
    setState("idle")
    setError(null)
  }, [variantId])

  const submit = async () => {
    setError(null)
    setState("sending")
    try {
      const r = await fetch("/api/restock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, variant_id: variantId }) })
      const d = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(d.error ?? "Не получилось")
      setState("done")
    } catch (e) {
      setError((e as Error).message)
      setState("idle")
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl bg-surface px-5 py-4 text-[13px] leading-relaxed" role="status">
        Готово. Напишем на <b className="font-medium">{email}</b>, как только размер {size} появится в наличии.
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-[13px]">Размера {size} сейчас нет. Сообщим на почту, когда появится.</p>
      <div className="mt-3 flex gap-2">
        <input type="email" inputMode="email" autoComplete="email" placeholder="Email" value={email} aria-label="Email"
          onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit() }}
          className="h-12 min-w-0 flex-1 rounded-full border border-line bg-background px-5 text-[14px] outline-none focus:border-foreground" />
        <button type="button" onClick={submit} disabled={state === "sending" || !email.trim()}
          className="h-12 shrink-0 rounded-full bg-foreground px-5 text-[14px] text-background disabled:opacity-60">
          {state === "sending" ? "Отправляем…" : "Сообщить"}
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-sale" role="alert">{error}</p>}
    </div>
  )
}
