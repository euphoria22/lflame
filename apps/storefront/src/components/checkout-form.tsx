"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { CheckoutInput, validateCheckout } from "@/lib/checkout"
import { DeliveryChoice, Quote, validateDelivery } from "@/lib/delivery"
import { formatPrice } from "@/lib/format"
import { routes } from "@/lib/routes"
import { useCart } from "./cart-context"
import { DeliveryPicker } from "./delivery-picker"

/**
 * Оформление на одной странице (ТЗ, п. 6.4): контакты → получение → оплата → подтверждение.
 * Без обязательной регистрации. Согласие на обработку ПД — отдельная галочка, не отмечена (п. 8.7).
 */
export function CheckoutForm() {
  const { cart, clear } = useCart()
  const router = useRouter()
  const [v, setV] = useState<Partial<CheckoutInput>>({ consent: false, marketing: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [delivery, setDelivery] = useState<DeliveryChoice>({ kind: "pickup" })
  const [quote, setQuote] = useState<Quote | null>({ amount: 0, days_min: 0, days_max: 0 })

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
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...v, delivery }) })
      const data = (await res.json()) as { order?: { number: number }; error?: string; errors?: Record<string, string> }
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
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 md:grid-cols-[1fr_380px] md:px-8">
      <div>
        <h1 className="text-[28px] tracking-tight md:text-[40px]">Оформление заказа</h1>

        <section className="mt-8">
          <h2 className="mb-4 text-[17px]">1. Контакты</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><input className={field} placeholder="Имя" autoComplete="given-name" value={v.first_name ?? ""} onChange={set("first_name")} aria-invalid={!!errors.first_name} />{err("first_name")}</div>
            <div><input className={field} placeholder="Фамилия" autoComplete="family-name" value={v.last_name ?? ""} onChange={set("last_name")} aria-invalid={!!errors.last_name} />{err("last_name")}</div>
            <div><input className={field} placeholder="Телефон" type="tel" inputMode="tel" autoComplete="tel" value={v.phone ?? ""} onChange={set("phone")} aria-invalid={!!errors.phone} />{err("phone")}</div>
            <div><input className={field} placeholder="Email" type="email" autoComplete="email" value={v.email ?? ""} onChange={set("email")} aria-invalid={!!errors.email} />{err("email")}</div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-[17px]">2. Получение</h2>
          <DeliveryPicker value={delivery} onChange={(d) => { setDelivery(d); setErrors((x) => ({ ...x, delivery: "" })) }}
            quote={quote} onQuote={setQuote} error={errors.delivery} />
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-[17px]">3. Оплата</h2>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground p-4">
            <input type="radio" name="payment" defaultChecked className="mt-1 accent-black" />
            <span className="text-[14px]">
              Оплата при получении
              <span className="mt-1 block text-[12px] text-muted">Онлайн-оплата картой, СБП и частями (Т-Касса, Яндекс Сплит) подключается.</span>
            </span>
          </label>
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
        <p className="text-[17px]">Ваш заказ</p>
        <ul className="mt-4 space-y-3">
          {cart?.lines.map((l) => (
            <li key={l.id} className="flex gap-3 text-[13px]">
              <span className="relative h-16 w-12 shrink-0 overflow-hidden bg-background">
                {l.thumbnail && <Image src={l.thumbnail} alt="" fill sizes="48px" className="blend object-contain" />}
              </span>
              <span className="flex-1"><span className="line-clamp-2">{l.title}</span><span className="text-muted">{l.size} · {l.quantity} шт.</span></span>
              <span>{formatPrice(l.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-[14px]">
          <div className="flex justify-between"><span className="text-muted">Товары</span><span>{formatPrice(cart?.item_total ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Доставка</span><span>{quote ? formatPrice(quote.amount) : "—"}</span></div>
          <div className="flex justify-between pt-2 text-[17px]"><span>Итого</span><span>{formatPrice((cart?.item_total ?? 0) + (quote?.amount ?? 0))}</span></div>
        </div>
        {error && <p className="mt-4 text-[13px] text-sale" role="alert">{error}</p>}
        <button type="submit" disabled={sending || !cart} className="mt-5 h-12 w-full rounded-full bg-foreground text-[14px] text-background disabled:opacity-60">
          {sending ? "Оформляем…" : "Подтвердить заказ"}
        </button>
      </aside>
    </form>
  )
}
