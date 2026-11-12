"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { EmailHint } from "./email-hint"

type Settings = { enabled: boolean; discount_pct: number }

/** Подписка на новости в подвале: письмо с одноразовым промокодом (скидка — из админки, «Рассылка»). */
export function NewsletterForm() {
  const [cfg, setCfg] = useState<Settings | null>(null)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done">("idle")
  const [result, setResult] = useState<{ status: string; promo: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/newsletter").then((r) => r.json()).then(setCfg).catch(() => setCfg(null))
  }, [])
  if (!cfg?.enabled) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setState("sending")
    try {
      const r = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) })
      const d = (await r.json()) as { status?: string; promo?: boolean; error?: string }
      if (!r.ok) throw new Error(d.error ?? "Не получилось")
      setResult({ status: d.status ?? "subscribed", promo: !!d.promo })
      setState("done")
    } catch (err) {
      setError((err as Error).message)
      setState("idle")
    }
  }

  return (
    // Полоса над колонками подвала: слева предложение, справа поле
    <div className="grid gap-6 border-b border-line pb-12 md:grid-cols-2 md:items-end">
      <div>
        <p className="text-[22px] tracking-tight md:text-[26px]">{cfg.discount_pct ? `−${cfg.discount_pct}% на первый заказ за подписку` : "Подпишитесь на новости"}</p>
        <p className="mt-2 text-[13px] leading-6 text-muted">
          Новые поступления, распродажи и закрытые акции.{cfg.discount_pct ? " Промокод придёт на почту сразу после подписки." : ""}
        </p>
      </div>
      <div className="md:justify-self-end md:w-full md:max-w-md">
      {state === "done" ? (
        <p className="text-[14px]" role="status">
          {result?.status === "already" ? "Вы уже подписаны." : result?.promo ? "Готово! Промокод отправили на почту." : "Готово! Вы подписаны."}
        </p>
      ) : (
        <form onSubmit={submit}>
          <div className="flex gap-2">
            <input type="email" required inputMode="email" autoComplete="email" placeholder="Email" aria-label="Email для подписки" value={email} onChange={(e) => setEmail(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-full border border-line bg-background px-4 text-[13px] outline-none focus:border-foreground" />
            <button type="submit" disabled={state === "sending"} className="h-11 shrink-0 rounded-full bg-foreground px-5 text-[13px] text-background disabled:opacity-60">
              {state === "sending" ? "…" : "Подписаться"}
            </button>
          </div>
          <EmailHint value={email} onFix={setEmail} className="px-4" />
          {error && <p className="mt-2 text-[12px] text-sale" role="alert">{error}</p>}
          <p className="mt-2 text-[11px] leading-snug text-subtle">
            Подписываясь, вы соглашаетесь получать рассылку и с <Link href="/privacy" className="underline underline-offset-2">политикой обработки данных</Link>. Отписаться можно в любой момент.
          </p>
        </form>
      )}
      </div>
    </div>
  )
}
