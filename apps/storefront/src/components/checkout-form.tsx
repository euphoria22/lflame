"use client"

import { formatPrice } from "@/lib/format"
import { CardIcon, HandIcon, PartsIcon } from "./method-icons"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { rememberPurchase } from "@/lib/analytics"
import { CheckoutInput, formatPhoneInput, PaymentMethod, validateCheckout } from "@/lib/checkout"
import { DeliveryChoice, Quote, validateDelivery } from "@/lib/delivery"
import { routes } from "@/lib/routes"
import { AskUs } from "./ask-us"
import { useCart } from "./cart-context"
import { CartLines } from "./cart-lines"
import { CartProgress } from "./cart-progress"
import { DeliveryPicker } from "./delivery-picker"
import { OrderSummary } from "./order-summary"

/**
 * Оформление на одной странице (ТЗ, п. 6.4): контакты → получение → оплата → подтверждение.
 * Без обязательной регистрации. Согласие на обработку ПД — отдельная галочка, не отмечена (п. 8.7).
 */
export type PaymentOptions = {
  online_payment: boolean; split_payment?: boolean; manual_payment: boolean; cod_methods: string[]
  delivery_texts?: Partial<Record<DeliveryChoice["kind"], { title: string; hint: string; logo: string | null }>>
  payment_logos?: { name: string; logo: string | null }[]
}

export function CheckoutForm({ options, notice, defaults }: { options: PaymentOptions; notice?: string | null; defaults?: Partial<CheckoutInput> }) {
  const { cart, clear } = useCart()
  const router = useRouter()
  const [v, setV] = useState<Partial<CheckoutInput>>({ consent: false, marketing: false, ...defaults })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(notice ?? null)
  const [chosenPayment, setPayment] = useState<PaymentMethod | null>(null)
  const [sending, setSending] = useState(false)
  const [delivery, setDelivery] = useState<DeliveryChoice>({ kind: "pickup" })
  // Доступные способы оплаты зависят от способа получения (оплата при получении — не везде)
  const available: PaymentMethod[] = [
    ...(options.online_payment ? ["tbank" as const] : []),
    ...(options.split_payment ? ["split" as const] : []),
    ...(options.manual_payment ? ["manual" as const] : []),
    ...(options.cod_methods.includes(delivery.kind) ? ["cod" as const] : []),
  ]
  const payment: PaymentMethod | null = chosenPayment && available.includes(chosenPayment) ? chosenPayment : available[0] ?? null
  const [quote, setQuote] = useState<Quote | null>({ amount: 0, days_min: 0, days_max: 0 })
  // Логотип Сплита — тот, что загружен для подвала («Доставка и оплата» → логотипы оплаты)
  const splitLogo = options.payment_logos?.find((p) => /сплит|split/i.test(p.name))?.logo ?? null

  const set = (k: keyof CheckoutInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value
    setV((x) => ({ ...x, [k]: value }))
    setErrors((x) => ({ ...x, [k]: "" }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = validateCheckout(v)
    const dErr = validateDelivery(delivery) ?? (delivery.kind !== "pickup" && !quote ? "Дождитесь расчёта доставки" : null)
    if (dErr) found.delivery = dErr
    setErrors(found)
    if (Object.keys(found).length) return
    setSending(true)
    setError(null)
    try {
      if (!payment) { setError("Выберите способ оплаты"); return }
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...v, delivery, payment }) })
      const data = (await res.json()) as { order?: { number: number }; redirect?: string; error?: string; errors?: Record<string, string> }
      if (res.ok) rememberPurchase(cart)
      if (res.ok && data.redirect) {
        // Переход на платёжную форму Т-Банка; корзина сохраняется до подтверждения оплаты
        window.location.assign(data.redirect)
        return
      }
      if (!res.ok || !data.order) {
        if (data.errors) setErrors(data.errors)
        setError(data.error ?? "Проверьте данные")
        return
      }
      clear()
      router.push(`/order/confirmed?n=${data.order.number}`)
    } catch {
      setError("Нет связи. Попробуйте ещё раз.")
    } finally {
      setSending(false)
    }
  }

  if (cart && !cart.lines.length) {
    return (
      <div className="py-24 text-center">
        <p className="text-[15px]">В корзине пусто</p>
        <Link href={routes.newIn()} className="mt-4 inline-block rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Смотреть новинки</Link>
      </div>
    )
  }

  const field = "h-12 w-full rounded-xl border border-line bg-background px-4 text-[14px] outline-none transition-colors focus:border-foreground"
  const err = (k: string) => errors[k] && <p className="mt-1 text-[12px] text-sale">{errors[k]}</p>

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pt-8 md:grid-cols-[minmax(0,1fr)_380px] md:px-8">
      <div>
        <h1 className="text-[28px] tracking-tight md:text-[40px]">Оформление заказа</h1>

        <section className="mt-8">
          <h2 className="mb-4 text-[17px]">1. Контакты</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><input className={field} placeholder="Имя" autoComplete="given-name" value={v.first_name ?? ""} onChange={set("first_name")} aria-invalid={!!errors.first_name} />{err("first_name")}</div>
            <div><input className={field} placeholder="Фамилия" autoComplete="family-name" value={v.last_name ?? ""} onChange={set("last_name")} aria-invalid={!!errors.last_name} />{err("last_name")}</div>
            <div><input className={field} placeholder="+7 (9__) ___-__-__" aria-label="Телефон" type="tel" inputMode="tel" autoComplete="tel" value={v.phone ?? ""} onChange={(e) => { setV((x) => ({ ...x, phone: formatPhoneInput(e.target.value, x.phone ?? "") })); setErrors((x) => ({ ...x, phone: "" })) }} aria-invalid={!!errors.phone} />{err("phone")}</div>
            <div><input className={field} placeholder="Email" type="email" autoComplete="email" value={v.email ?? ""} onChange={set("email")} aria-invalid={!!errors.email} />{err("email")}</div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-[17px]">2. Получение</h2>
          <DeliveryPicker value={delivery} onChange={(d) => { setDelivery(d); setErrors((x) => ({ ...x, delivery: "" })) }}
            quote={quote} onQuote={setQuote} error={errors.delivery} texts={options.delivery_texts} refreshKey={`${cart?.goods_total ?? 0}:${cart?.count ?? 0}`} />
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-[17px]">3. Оплата</h2>
          <div className="space-y-2">
            {available.includes("tbank") && (
              <PayOption checked={payment === "tbank"} onSelect={() => setPayment("tbank")} title="Картой или СБП онлайн" icon={<CardIcon className="size-5 text-muted" />}
                hint="Visa, Mastercard, МИР, СБП, T-Pay — безопасная оплата на странице Т-Банка" />
            )}
            {available.includes("split") && (
              <PayOption checked={payment === "split"} onSelect={() => setPayment("split")} title="Частями — Яндекс Сплит" icon={splitLogo ? <img src={splitLogo} alt="" className="max-h-7 max-w-[48px] object-contain" /> : <PartsIcon className="size-5 text-muted" />}
                hint={`${cart ? `4 платежа по ${formatPrice(Math.ceil((cart.goods_total + (quote?.amount ?? 0)) / 4))} ` : "4 платежа "}раз в 2 недели, без переплаты. Первый — сейчас, одобрение за минуту на странице Яндекс Пэй`} />
            )}
            {available.includes("manual") && (
              <PayOption checked={payment === "manual"} onSelect={() => setPayment("manual")} title="Предоплата по ссылке" icon={<CardIcon className="size-5 text-muted" />}
                hint="Подтвердим наличие и пришлём ссылку на оплату. Отправим заказ после оплаты." />
            )}
            {available.includes("cod") && (
              <PayOption checked={payment === "cod"} onSelect={() => setPayment("cod")} title="При получении" icon={<HandIcon className="size-5 text-muted" />}
                hint={delivery.kind === "pickup" ? "Картой или наличными в магазине" : "Картой или наличными при получении"} />
            )}
            {!available.length && <p className="text-[13px] text-sale">Оплата сейчас недоступна — позвоните нам, оформим заказ по телефону.</p>}
          </div>
        </section>

        <section className="mt-10">
          <textarea className={`${field} h-24 py-3`} placeholder="Комментарий к заказу (необязательно)" value={v.comment ?? ""} onChange={set("comment")} maxLength={1000} />
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-[13px]">
            <input type="checkbox" checked={!!v.consent} onChange={set("consent")} className="mt-0.5 size-4 accent-black" aria-invalid={!!errors.consent} />
            <span>Согласен на <Link href={routes.page("privacy")} className="underline underline-offset-4" target="_blank">обработку персональных данных</Link> и принимаю <Link href={routes.page("offer")} className="underline underline-offset-4" target="_blank">условия оферты</Link></span>
          </label>
          {err("consent")}
          <label className="mt-3 flex cursor-pointer items-start gap-3 text-[13px] text-muted">
            <input type="checkbox" checked={!!v.marketing} onChange={set("marketing")} className="mt-0.5 size-4 accent-black" />
            <span>Хочу получать новости о поступлениях и скидках</span>
          </label>
        </section>
      </div>

      <aside className="h-fit rounded-[22px] bg-surface p-6 md:sticky md:top-[96px]">
        <p className="text-[22px] tracking-tight">Ваш заказ</p>
        {/* Размер и количество можно поменять и здесь */}
        {cart && <div className="mt-2 border-b border-line pb-4"><CartLines cart={cart} compact /></div>}
        {cart && <div className="mt-5"><OrderSummary cart={cart} delivery={quote ? quote.amount : null} /></div>}
        {error && <p className="mt-4 text-[13px] text-sale" role="alert">{error}</p>}
        <button type="submit" disabled={sending || !cart} className="mt-5 h-12 w-full rounded-full bg-foreground text-[14px] text-background disabled:opacity-60">
          {sending ? "Оформляем…" : payment === "tbank" || payment === "split" ? "Перейти к оплате" : "Подтвердить заказ"}
        </button>
        {cart && <CartProgress total={cart.goods_total} className="mt-5 border-t border-line pt-5" />}
        <AskUs compact className="mt-4" message="Здравствуйте! Вопрос по оформлению заказа" />
      </aside>
    </form>
  )
}

function PayOption({ checked, onSelect, title, hint, icon }: { checked: boolean; onSelect: () => void; title: string; hint: string; icon: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${checked ? "border-foreground" : "border-line"}`}>
      <input type="radio" name="payment" checked={checked} onChange={onSelect} className="accent-black" />
      <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">{icon}</span>
      <span className="text-[14px]">
        {title}
        <span className="mt-1 block text-[12px] text-muted">{hint}</span>
      </span>
    </label>
  )
}
