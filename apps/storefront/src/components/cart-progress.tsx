"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { formatPrice } from "@/lib/format"
import type { LoyaltyStatus } from "./loyalty-card"
import { resetMyDiscount } from "./your-price"

// Настройки и уровень загружаются один раз на вкладку
let optionsReq: Promise<number> | null = null
let loyaltyReq: Promise<{ logged: boolean; loyalty?: LoyaltyStatus }> | null = null

/** После входа или выхода уровень нужно запросить заново. */
export function resetCartProgress() {
  loyaltyReq = null
  resetMyDiscount()
}

function loadThreshold(): Promise<number> {
  optionsReq ??= fetch("/api/checkout/options").then((r) => r.json()).then((d: { free_shipping_from?: number }) => Number(d.free_shipping_from ?? 0)).catch(() => 0)
  return optionsReq
}
type Tier = { code: string; name: string; threshold: number; discount: number }
let programReq: Promise<{ enabled: boolean; tiers: Tier[] }> | null = null
function loadProgram() {
  programReq ??= fetch("/api/loyalty/program").then((r) => r.json()).catch(() => ({ enabled: false, tiers: [] }))
  return programReq
}
function loadLoyalty() {
  loyaltyReq ??= fetch("/api/account/loyalty").then((r) => r.json()).catch(() => ({ logged: false }))
  return loyaltyReq
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-line" aria-hidden>
      <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  )
}

/**
 * Прогресс в корзине: бесплатная доставка и уровень программы LAFLAMME.
 * Показывается в панели корзины, на странице корзины и при оформлении.
 */
export function CartProgress({ total, className = "" }: { total: number; className?: string }) {
  const [from, setFrom] = useState<number | null>(null)
  const [loy, setLoy] = useState<{ logged: boolean; loyalty?: LoyaltyStatus } | null>(null)
  const [program, setProgram] = useState<{ enabled: boolean; tiers: Tier[] } | null>(null)
  useEffect(() => {
    loadThreshold().then(setFrom)
    loadLoyalty().then(setLoy)
    loadProgram().then(setProgram)
  }, [])

  // Гость или телефон ещё не засчитан: показываем, какой уровень даст этот заказ
  const guest = !!loy && (!loy.logged || (!!loy.loyalty?.enabled && !loy.loyalty.confirmed)) && !!program?.enabled
  const gTiers = [...(program?.tiers ?? [])].sort((a, b) => a.threshold - b.threshold)
  const gNext = gTiers.find((t) => t.threshold > total) ?? null
  const gReached = gTiers.filter((t) => t.threshold > 0 && t.threshold <= total).pop() ?? null

  const left = from ? from - total : 0
  const l = loy?.loyalty
  // Сумма за год + ожидающие зачёта + этот заказ
  const projected = l ? l.total + l.pending + total : 0
  const nextAfter = l ? l.tiers.find((t) => t.threshold > projected) ?? null : null
  const reached = l?.next && projected >= l.next.threshold ? l.tiers.filter((t) => t.threshold <= projected).pop() : null

  return (
    <div className={`space-y-3 ${className}`}>
      {!!from && (
        <div>
          <p className="text-[12px] text-muted">
            {left > 0 ? <>До бесплатной доставки — <span className="text-foreground">{formatPrice(left)}</span></> : <span className="text-foreground">Бесплатная доставка до пункта СДЭК и Почтой России</span>}
          </p>
          <Bar pct={(total / from) * 100} />
        </div>
      )}

      {guest && (
        <div>
          <p className="text-[12px] text-muted">
            {gReached
              ? <>С этим заказом — уровень <span className="text-foreground">{gReached.name} (−{gReached.discount}%)</span> в LAFLAMME Club</>
              : gNext
                ? <>До {gNext.name} (−{gNext.discount}%) в LAFLAMME Club — <span className="text-foreground">{formatPrice(gNext.threshold - total)}</span></>
                : null}
          </p>
          {gNext && <Bar pct={(total / gNext.threshold) * 100} />}
          <p className="mt-1.5 text-[12px] text-muted">
            {!loy?.logged
              ? <><Link href="/account/login?next=/cart" className="text-foreground underline underline-offset-4">Авторизуйтесь</Link>, чтобы покупки засчитывались — скидка до 15%</>
              : <>Укажите телефон в <Link href="/account" className="text-foreground underline underline-offset-4">профиле</Link>, чтобы покупки засчитывались</>}
          </p>
        </div>
      )}
      {l?.enabled && l.confirmed && (
        <div>
          <p className="text-[12px] text-muted">
            {reached
              ? <>С этим заказом — уровень <span className="text-foreground">{reached.name} (−{reached.discount}%)</span></>
              : nextAfter
                ? <>До {nextAfter.name} (−{nextAfter.discount}%) с этим заказом — <span className="text-foreground">{formatPrice(nextAfter.threshold - projected)}</span></>
                : <>У вас высший уровень {l.level.name}</>}
            {l.level.discount > 0 && <> · ваша скидка {l.level.name} −{l.level.discount}% уже в цене</>}
          </p>
          {(reached || nextAfter) && <Bar pct={nextAfter ? (projected / nextAfter.threshold) * 100 : 100} />}
        </div>
      )}
    </div>
  )
}
