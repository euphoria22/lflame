"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { formatPrice } from "@/lib/format"
import { routes } from "@/lib/routes"
import { EmailHint } from "./email-hint"
import { GiftCardVisual } from "./gift-card-visual"

export type GiftConfig = { enabled: boolean; amounts: number[]; min: number; max: number; validity_months: number; online_payment: boolean }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MESSAGE_MAX = 500

/** Завтра в формате ГГГГ-ММ-ДД (по времени покупателя) */
function tomorrow() {
  const d = new Date(Date.now() + 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Покупка подарочной карты: номинал (готовый или свой), себе или в подарок (получатель, поздравление,
 * день отправки), контакты покупателя → оплата в Т-Банке. Слева — карта, как её увидит получатель.
 */
export function GiftCardForm({ config, failed }: { config: GiftConfig; failed?: boolean }) {
  const [preset, setPreset] = useState<number | null>(config.amounts[1] ?? config.amounts[0] ?? null)
  const [custom, setCustom] = useState("")
  const [gift, setGift] = useState(true)
  const [to, setTo] = useState({ name: "", email: "" })
  const [message, setMessage] = useState("")
  const [later, setLater] = useState(false)
  const [date, setDate] = useState(tomorrow())
  const [me, setMe] = useState({ name: "", email: "", phone: "" })
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(failed ? "Оплата не прошла. Попробуйте ещё раз или выберите другую карту." : null)
  const [sending, setSending] = useState(false)

  const amount = useMemo(() => {
    if (preset) return preset
    const n = Number(custom.replace(/\D/g, ""))
    return n || null
  }, [preset, custom])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!amount || (!config.amounts.includes(amount) && (amount < config.min || amount > config.max))) e.amount = `Сумма — от ${formatPrice(config.min)} до ${formatPrice(config.max)}`
    if (gift && !EMAIL.test(to.email.trim())) e.to_email = "Укажите email получателя"
    if (gift && later && (!date || date < tomorrow())) e.date = "Выберите дату с завтрашнего дня"
    if (!me.name.trim()) e.name = "Укажите ваше имя"
    if (!EMAIL.test(me.email.trim())) e.email = "Укажите ваш email — пришлём чек и копию карты"
    if (!consent) e.consent = "Нужно согласие"
    return e
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setSending(true)
    setError(null)
    try {
      const r = await fetch("/api/gift-cards/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          buyer: { name: me.name.trim(), email: me.email.trim(), phone: me.phone.trim() || null },
          recipient: gift ? { name: to.name.trim() || null, email: to.email.trim() } : null,
          message: gift ? message.trim() || null : null,
          send_date: gift && later ? date : null,
        }),
      })
      const d = (await r.json().catch(() => ({}))) as { redirect?: string; error?: string }
      if (r.ok && d.redirect) { window.location.assign(d.redirect); return }
      setError(d.error ?? "Не получилось перейти к оплате. Попробуйте ещё раз.")
    } catch {
      setError("Нет связи. Попробуйте ещё раз.")
    } finally {
      setSending(false)
    }
  }

  const field = "h-12 w-full rounded-xl border border-line bg-background px-4 text-[14px] outline-none transition-colors focus:border-foreground"
  const err = (k: string) => errors[k] && <p className="mt-1 text-[12px] text-sale">{errors[k]}</p>
  const chip = (on: boolean) => `tag-font h-12 rounded-full border px-5 text-[14px] transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground"}`
  const tab = (on: boolean) => `h-11 flex-1 rounded-full text-[14px] transition-colors ${on ? "bg-foreground text-background" : "hover:bg-surface"}`

  if (!config.enabled || !config.online_payment) {
    return <p className="rounded-[22px] bg-surface p-6 text-[15px]">Сейчас подарочные карты на сайте не продаются. Купить карту можно в шоуруме в Омске или написав нам в Telegram.</p>
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14">
      <div className="md:sticky md:top-[110px] md:self-start">
        <GiftCardVisual amount={amount} to={gift ? to.name.trim() || null : null} />
        {gift && message.trim() && (
          <p className="mt-5 whitespace-pre-line border-l-2 border-foreground pl-4 text-[14px] leading-relaxed">{message.trim()}{me.name.trim() && <span className="mt-1 block text-[13px] text-muted">— {me.name.trim()}</span>}</p>
        )}
        <p className="mt-5 text-[13px] leading-relaxed text-muted">
          Электронная карта приходит на email с кодом. Действует {config.validity_months === 12 ? "1 год" : `${config.validity_months} мес.`}, тратится частями — на сайте и в шоуруме в Омске.
        </p>
      </div>

      <div className="space-y-9">
        <section>
          <h2 className="mb-4 text-[17px]">1. Номинал</h2>
          <div className="flex flex-wrap gap-2">
            {config.amounts.map((a) => (
              <button key={a} type="button" className={chip(preset === a)} onClick={() => { setPreset(a); setCustom(""); setErrors((x) => ({ ...x, amount: "" })) }}>{formatPrice(a)}</button>
            ))}
          </div>
          <div className="mt-3">
            <input className={field} inputMode="numeric" placeholder={`Своя сумма: от ${formatPrice(config.min)} до ${formatPrice(config.max)}`} value={custom}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCustom(v ? Number(v).toLocaleString("ru-RU") : ""); setPreset(null); setErrors((x) => ({ ...x, amount: "" })) }} />
            {err("amount")}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[17px]">2. Кому</h2>
          <div className="flex gap-1 rounded-full border border-line p-1">
            <button type="button" className={tab(gift)} onClick={() => setGift(true)}>В подарок</button>
            <button type="button" className={tab(!gift)} onClick={() => setGift(false)}>Себе</button>
          </div>
          {gift && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={field} placeholder="Имя получателя" value={to.name} onChange={(e) => setTo((x) => ({ ...x, name: e.target.value }))} maxLength={100} />
                <div>
                  <input className={field} type="email" inputMode="email" placeholder="Email получателя" value={to.email} onChange={(e) => { setTo((x) => ({ ...x, email: e.target.value })); setErrors((x) => ({ ...x, to_email: "" })) }} />
                  {err("to_email")}
                  <EmailHint value={to.email} onFix={(email) => setTo((x) => ({ ...x, email }))} />
                </div>
              </div>
              <div>
                <textarea className={`${field} h-28 py-3`} placeholder="Поздравление (необязательно) — будет в письме вместе с картой" value={message} maxLength={MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} />
                <p className="mt-1 text-right text-[12px] text-subtle">{message.length} / {MESSAGE_MAX}</p>
              </div>
              <div>
                <p className="mb-2 text-[14px]">Когда отправить</p>
                <div className="flex gap-1 rounded-full border border-line p-1">
                  <button type="button" className={tab(!later)} onClick={() => setLater(false)}>Сразу после оплаты</button>
                  <button type="button" className={tab(later)} onClick={() => setLater(true)}>Выбрать дату</button>
                </div>
                {later && (
                  <div className="mt-3">
                    <input className={field} type="date" min={tomorrow()} value={date} onChange={(e) => { setDate(e.target.value); setErrors((x) => ({ ...x, date: "" })) }} />
                    <p className="mt-1 text-[12px] text-muted">Письмо придёт утром выбранного дня. Вам — сразу чек и копия карты.</p>
                    {err("date")}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-[17px]">3. {gift ? "От кого" : "Ваши данные"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><input className={field} placeholder="Ваше имя" autoComplete="name" value={me.name} onChange={(e) => { setMe((x) => ({ ...x, name: e.target.value })); setErrors((x) => ({ ...x, name: "" })) }} maxLength={100} />{err("name")}</div>
            <div>
              <input className={field} type="email" inputMode="email" autoComplete="email" placeholder="Ваш email" value={me.email} onChange={(e) => { setMe((x) => ({ ...x, email: e.target.value })); setErrors((x) => ({ ...x, email: "" })) }} />
              {err("email")}
              <EmailHint value={me.email} onFix={(email) => setMe((x) => ({ ...x, email }))} />
            </div>
          </div>
          <input className={`${field} mt-3`} type="tel" inputMode="tel" autoComplete="tel" placeholder="Телефон (необязательно)" value={me.phone} onChange={(e) => setMe((x) => ({ ...x, phone: e.target.value }))} maxLength={30} />
        </section>

        <section>
          <label className="flex cursor-pointer items-start gap-3 text-[13px]">
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, consent: "" })) }} className="mt-0.5 size-4 accent-black" />
            <span>Согласен на <Link href={routes.page("privacy")} className="underline underline-offset-4" target="_blank">обработку персональных данных</Link> и принимаю <Link href={routes.page("offer")} className="underline underline-offset-4" target="_blank">условия оферты</Link></span>
          </label>
          {err("consent")}
          {error && <p className="mt-4 text-[13px] text-sale" role="alert">{error}</p>}
          <button type="submit" disabled={sending} className="mt-5 h-12 w-full rounded-full bg-foreground text-[14px] text-background disabled:opacity-60">
            {sending ? "Переходим к оплате…" : amount ? `Оплатить ${formatPrice(amount)}` : "Оплатить"}
          </button>
          <p className="mt-2 text-center text-[12px] text-subtle">Картой или СБП на странице Т-Банка</p>
        </section>
      </div>
    </form>
  )
}
