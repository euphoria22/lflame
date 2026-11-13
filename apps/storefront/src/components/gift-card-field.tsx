"use client"

import { useEffect, useState } from "react"

import { formatPrice } from "@/lib/format"

export type AppliedGift = { code: string; balance: number }

/**
 * «Подарочная карта» при оформлении: ввести код — сумма к оплате уменьшится на остаток карты
 * (не больше суммы заказа). Деньги спишутся с карты, когда заказ будет создан.
 */
export function GiftCardField({ value, onChange, due }: { value: AppliedGift | null; onChange: (g: AppliedGift | null) => void; due: number }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Карта, применённая раньше (вернулись со страницы оплаты)
  useEffect(() => {
    fetch("/api/cart/gift-card").then((r) => r.json()).then((d: { gift_card?: AppliedGift | null }) => { if (d.gift_card) onChange(d.gift_card) }).catch(() => null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз при открытии оформления
  }, [])

  const send = async (method: "POST" | "DELETE") => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch("/api/cart/gift-card", { method, headers: { "content-type": "application/json" }, body: method === "POST" ? JSON.stringify({ code }) : undefined })
      const d = (await r.json().catch(() => ({}))) as { gift_card?: AppliedGift | null; error?: string }
      if (!r.ok) { setError(d.error ?? "Не получилось применить карту"); return }
      onChange(d.gift_card ?? null)
      setCode("")
    } catch {
      setError("Нет связи. Попробуйте ещё раз.")
    } finally {
      setBusy(false)
    }
  }

  if (value) {
    const spend = Math.min(value.balance, Math.max(0, due))
    return (
      <div className="rounded-xl border border-foreground p-4 text-[13px]">
        <div className="flex items-center justify-between gap-3">
          <span>Подарочная карта <b className="font-medium tag-font">{value.code}</b></span>
          <button type="button" disabled={busy} onClick={() => send("DELETE")} className="text-muted underline underline-offset-4 hover:text-foreground disabled:opacity-50">Убрать</button>
        </div>
        <p className="mt-1 text-muted">
          Спишем {formatPrice(spend)}{value.balance > spend ? `, на карте останется ${formatPrice(value.balance - spend)}` : ""}
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] text-muted underline underline-offset-4 hover:text-foreground">
        Есть подарочная карта?
      </button>
    )
  }

  return (
    <div>
      <p className="mb-2 text-[13px] text-muted">Код подарочной карты</p>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }} placeholder="LF-XXXX-XXXX-XXXX" aria-label="Код подарочной карты" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (code.trim()) send("POST") } }}
          className="tag-font h-11 min-w-0 flex-1 rounded-full border border-line bg-background px-4 text-[13px] uppercase outline-none placeholder:text-subtle focus:border-foreground" />
        <button type="button" disabled={busy || !code.trim()} onClick={() => send("POST")} className="h-11 shrink-0 rounded-full border border-foreground px-5 text-[13px] hover:bg-foreground hover:text-background disabled:opacity-50">
          {busy ? "…" : "Применить"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-sale" role="alert">{error}</p>}
      <p className="mt-1.5 text-[12px] leading-snug text-subtle">Скидки Laflamme Club и акции тоже действуют — карта уменьшает сумму к оплате.</p>
    </div>
  )
}
