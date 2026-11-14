"use client"

import { useState } from "react"

import { formatPrice } from "@/lib/format"

type Result = { found: boolean; ok: boolean; reason: string | null; balance: number; amount: number; expires_at: string | null }

/** «Проверить баланс»: остаток и срок карты по коду */
export function GiftCardBalance() {
  const [code, setCode] = useState("")
  const [r, setR] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    setR(null)
    try {
      const res = await fetch("/api/gift-cards/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) })
      const d = (await res.json().catch(() => ({}))) as Result & { error?: string }
      if (!res.ok) setError(d.error ?? "Не получилось проверить. Попробуйте позже.")
      else setR(d)
    } catch {
      setError("Нет связи. Попробуйте ещё раз.")
    } finally {
      setBusy(false)
    }
  }

  const date = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Omsk" })
  return (
    <form onSubmit={check} className="max-w-xl">
      <div className="flex gap-2">
        <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setR(null); setError(null) }} placeholder="LF-XXXX-XXXX-XXXX" aria-label="Код подарочной карты"
          className="tag-font h-12 min-w-0 flex-1 rounded-full border border-line bg-background px-5 text-[14px] uppercase outline-none placeholder:text-subtle focus:border-foreground" />
        <button type="submit" disabled={busy || !code.trim()} className="h-12 shrink-0 rounded-full border border-foreground px-6 text-[14px] hover:bg-foreground hover:text-background disabled:opacity-50">
          {busy ? "…" : "Проверить"}
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-sale" role="alert">{error}</p>}
      {r && (
        r.found ? (
          <div className="mt-4 rounded-2xl bg-surface px-5 py-4">
            <p className="text-[13px] text-muted">На карте</p>
            <p className="tag-font mt-1 text-[28px] leading-none">{formatPrice(r.balance)}</p>
            <p className="mt-2 text-[13px] text-muted">
              Номинал {formatPrice(r.amount)}{r.expires_at ? ` · действует до ${date(r.expires_at)}` : ""}
            </p>
            {!r.ok && r.reason && <p className="mt-2 text-[13px] text-sale">{r.reason}</p>}
          </div>
        ) : <p className="mt-2 text-[13px] text-sale">{r.reason ?? "Карта не найдена — проверьте код"}</p>
      )}
    </form>
  )
}
