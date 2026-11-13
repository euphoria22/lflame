"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { formatPrice } from "@/lib/format"
import { SITE_URL } from "@/lib/site"
import { GiftCardVisual } from "./gift-card-visual"

type Result = { found: boolean; ok: boolean; reason: string | null; balance: number; amount: number; expires_at: string | null }

const fmt = (c: string) => (c.length === 14 ? `${c.slice(0, 2)}-${c.slice(2, 6)}-${c.slice(6, 10)}-${c.slice(10)}` : c)
/** Админка — поддомен admin. того же сайта */
const adminUrl = (code: string) => `${SITE_URL.replace(/^(https?:\/\/)(www\.)?/, "$1admin.")}/app/gift-cards?q=${code}`

/**
 * Карта на сайте: открывают по ссылке из письма или по QR. Остаток — тем же запросом, что «Проверить баланс»
 * (с ограничением частоты), QR — чтобы показать на кассе. Продавец сканирует QR и открывает карту в админке.
 */
export function GiftCardPage({ code: raw }: { code: string }) {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const [r, setR] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    fetch("/api/gift-cards/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) })
      .then(async (res) => {
        const d = (await res.json().catch(() => ({}))) as Result & { error?: string }
        if (off) return
        if (!res.ok) setError(d.error ?? "Не получилось загрузить карту")
        else setR(d)
      })
      .catch(() => { if (!off) setError("Нет связи. Обновите страницу.") })
    return () => { off = true }
  }, [code])

  const date = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
  if (r && !r.found) {
    return (
      <div className="pt-10 text-center">
        <h1 className="text-[28px] tracking-tight">Карта не найдена</h1>
        <p className="mt-3 text-[15px] text-muted">Проверьте ссылку из письма или введите код на странице <Link href="/gift-cards#balance" className="underline underline-offset-4">подарочных карт</Link>.</p>
      </div>
    )
  }
  return (
    <div>
      <GiftCardVisual amount={r ? r.balance : null} code={fmt(code)} />
      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">На карте</p>
          <p className="tag-font mt-1 text-[30px] leading-none">{r ? formatPrice(r.balance) : "…"}</p>
          {r && <p className="mt-2 text-[13px] text-muted">Номинал {formatPrice(r.amount)}{r.expires_at ? ` · действует до ${date(r.expires_at)}` : ""}</p>}
          {r && !r.ok && r.reason && <p className="mt-2 text-[13px] text-sale">{r.reason}</p>}
          {error && <p className="mt-2 text-[13px] text-sale">{error}</p>}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-5 rounded-[22px] bg-surface p-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG с сервера, оптимизация не нужна */}
        <img src={`/api/gift-cards/qr?code=${code}`} alt="QR-код карты" width={132} height={132} className="size-[132px] shrink-0 rounded-xl bg-white p-1.5" />
        <p className="text-[14px] leading-relaxed">
          <b className="font-medium">В шоуруме</b> — покажите этот QR-код на кассе, продавец его отсканирует.
          <span className="mt-2 block text-[13px] text-muted">На сайте — введите код при оформлении заказа в поле «Подарочная карта». Сохраните страницу в закладки или сделайте скриншот.</span>
        </p>
      </div>

      <p className="mt-4 rounded-2xl border border-line px-4 py-3 text-[13px] leading-relaxed">
        🔒 <b className="font-medium">Не показывайте код и QR-код карты посторонним</b> — по ним картой может воспользоваться кто угодно вместо вас. Не публикуйте скриншоты карты и не пересылайте ссылку на эту страницу.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/new" className="rounded-full bg-foreground px-6 py-3 text-[14px] text-background">Выбрать подарок</Link>
        <a href={adminUrl(code)} className="rounded-full border border-line px-6 py-3 text-[14px] text-muted hover:border-foreground">Для продавца: открыть в админке</a>
      </div>
    </div>
  )
}
