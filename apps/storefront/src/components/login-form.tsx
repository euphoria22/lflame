"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

/** Вход без пароля: email -> код из письма (ТЗ, п. 6.5). */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!wait) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError("Проверьте email"); return }
    setBusy(true); setError(null)
    const r = await fetch("/api/account/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim() }) })
    const d = (await r.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!r.ok && r.status !== 429) { setError(d.error ?? "Не удалось отправить код"); return }
    if (r.status === 429) setError(d.error ?? null)
    setStep("code"); setWait(60)
    setTimeout(() => codeRef.current?.focus(), 50)
  }

  const login = async (value = code) => {
    if (value.length !== 6) return
    setBusy(true); setError(null)
    const r = await fetch("/api/account/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), code: value }) })
    const d = (await r.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!r.ok) { setError(d.error ?? "Неверный код"); setCode(""); return }
    router.replace(next)
    router.refresh()
  }

  const field = "h-12 w-full rounded-xl border border-line bg-background px-4 text-[15px] outline-none transition-colors focus:border-foreground"

  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-[28px] tracking-tight">Вход</h1>
      {step === "email" ? (
        <form onSubmit={requestCode} className="mt-6 space-y-3" noValidate>
          <p className="text-[14px] text-muted">Пришлём код на почту — без пароля. Если вы ещё не покупали у нас, аккаунт создастся сам.</p>
          <input className={field} type="email" inputMode="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          {error && <p className="text-[13px] text-sale" role="alert">{error}</p>}
          <button disabled={busy} className="h-12 w-full rounded-full bg-foreground text-[14px] text-background disabled:opacity-60">{busy ? "Отправляем…" : "Получить код"}</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); login() }} className="mt-6 space-y-3" noValidate>
          <p className="text-[14px] text-muted">Код отправлен на <span className="text-foreground">{email}</span>. Проверьте папку «Спам», если письма нет.</p>
          <input ref={codeRef} className={`${field} text-center text-[22px] tracking-[0.5em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
            value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) login(v) }} aria-label="Код из письма" />
          {error && <p className="text-[13px] text-sale" role="alert">{error}</p>}
          <button disabled={busy || code.length !== 6} className="h-12 w-full rounded-full bg-foreground text-[14px] text-background disabled:opacity-60">{busy ? "Входим…" : "Войти"}</button>
          <div className="flex justify-between text-[13px] text-muted">
            <button type="button" className="underline underline-offset-4" onClick={() => { setStep("email"); setCode(""); setError(null) }}>Другой email</button>
            <button type="button" disabled={wait > 0 || busy} className="underline underline-offset-4 disabled:no-underline" onClick={() => requestCode()}>
              {wait > 0 ? `Отправить снова через ${wait} с` : "Отправить код снова"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
