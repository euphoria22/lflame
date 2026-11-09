"use client"

import { useState } from "react"

import { useCart } from "./cart-context"

/** Поле промокода в корзине и при оформлении. Промокод и скидка LAFLAMME не суммируются — действует выгодная. */
export function PromoField({ className = "", defaultOpen = false }: { className?: string; defaultOpen?: boolean }) {
  const { cart, busy, promo } = useCart()
  const [open, setOpen] = useState(defaultOpen)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  if (!cart) return null
  const current = cart.promo

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    const err = await promo(code.trim())
    setError(err)
    if (!err) setCode("")
  }

  if (current) {
    return (
      <div className={`text-[13px] ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <span>Промокод <b className="font-medium">{current.code}</b>{current.applied && <span className="text-muted"> · применён</span>}</span>
          <button type="button" disabled={busy} onClick={async () => { setError(await promo(null)) }} className="text-muted underline underline-offset-4 hover:text-foreground disabled:opacity-50">Убрать</button>
        </div>
        {current.note && <p className="mt-1 text-[12px] leading-snug text-muted">{current.note}</p>}
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`text-[13px] text-muted underline underline-offset-4 hover:text-foreground ${className}`}>
        Есть промокод?
      </button>
    )
  }

  // div, а не form: поле стоит и внутри формы оформления заказа
  return (
    <div className={className}>
      {defaultOpen && <p className="mb-2 text-[13px] text-muted">У меня есть промокод</p>}
      <div className="flex gap-2">
        <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }} placeholder="Введите код" aria-label="Промокод" autoFocus={!defaultOpen}
          onKeyDown={(e) => { if (e.key === "Enter") submit(e) }}
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-background px-4 text-[13px] uppercase outline-none placeholder:normal-case focus:border-foreground" />
        <button type="button" disabled={busy || !code.trim()} onClick={submit} className="h-10 shrink-0 rounded-full border border-foreground px-4 text-[13px] hover:bg-foreground hover:text-background disabled:opacity-50">
          Применить
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-sale" role="alert">{error}</p>}
      <p className="mt-1.5 text-[12px] leading-snug text-subtle">Не суммируется со скидкой Laflamme Club — применим ту, что выгоднее.</p>
    </div>
  )
}
