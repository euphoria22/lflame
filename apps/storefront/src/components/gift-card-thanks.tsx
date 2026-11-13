"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { GiftCardVisual } from "./gift-card-visual"

type Status = { status: "pending" | "active" | "disabled"; amount: number; to: string | null; gift: boolean; send_at: string | null; later?: boolean }

/** «Спасибо»: ждём подтверждения оплаты (опрос раз в 3 секунды, до 2 минут) и говорим, куда ушла карта */
export function GiftCardThanks() {
  const [s, setS] = useState<Status | null>(null)
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id")
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (!id) { setGaveUp(true); return }
      const d = (await fetch(`/api/gift-cards/status?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Status | null
      // Письмо получателю — позже (выбранный день), а не сразу
      if (d) setS({ ...d, later: !!d.send_at && new Date(d.send_at).getTime() > Date.now() + 5 * 60_000 })
      if (d?.status === "active") return
      if (++tries > 40) { setGaveUp(true); return }
      timer = setTimeout(poll, 3000)
    }
    timer = setTimeout(poll, 0)
    return () => clearTimeout(timer)
  }, [])

  const later = s?.later
  const day = s?.send_at ? new Date(s.send_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : ""
  return (
    <div className="text-center">
      <div className="mx-auto max-w-sm"><GiftCardVisual amount={s?.amount ?? null} /></div>
      {s?.status === "active" ? (
        <>
          <h1 className="mt-10 text-[28px] tracking-tight md:text-[36px]">Спасибо! Карта оплачена</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
            {s.gift
              ? later ? `Отправим карту получателю на ${s.to} утром ${day}. Вам на почту — чек и копия карты.` : `Отправили карту получателю на ${s.to}. Вам на почту — чек и копия карты.`
              : `Отправили карту на ${s.to}. Код — в письме.`}
          </p>
        </>
      ) : gaveUp ? (
        <>
          <h1 className="mt-10 text-[28px] tracking-tight md:text-[36px]">Проверяем оплату</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">Как только банк подтвердит платёж, карта придёт на почту. Если письма нет в течение часа — напишите нам, разберёмся.</p>
        </>
      ) : (
        <>
          <h1 className="mt-10 text-[28px] tracking-tight md:text-[36px]">Подтверждаем оплату…</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-muted">Обычно это несколько секунд.</p>
        </>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/new" className="rounded-full bg-foreground px-6 py-3 text-[14px] text-background">В каталог</Link>
        <Link href="/gift-cards" className="rounded-full border border-line px-6 py-3 text-[14px] hover:border-foreground">Ещё одну карту</Link>
      </div>
    </div>
  )
}
