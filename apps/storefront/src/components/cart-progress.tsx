"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { formatPrice } from "@/lib/format"
import type { LoyaltyStatus } from "@/lib/account-types"
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

/** Полоска прогресса: доставка — чёрная, Laflamme Club — золотистая (чтобы не сливались). */
function Bar({ pct, tone = "delivery" }: { pct: number; tone?: "delivery" | "club" }) {
  return (
    <div className={`mt-1.5 h-[3px] overflow-hidden rounded-full ${tone === "club" ? "bg-club/20" : "bg-line"}`} aria-hidden>
      <div className={`h-full rounded-full transition-[width] duration-500 ${tone === "club" ? "bg-club" : "bg-foreground"}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
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

  // Целевой уровень для полоски: если заказ дотягивает до уровня — он (полоска полная), иначе следующий
  const gTarget = gReached && (!gNext || gReached.threshold > 0) ? gReached : gNext
  const tag = <span className="eyebrow ml-1 rounded-full border border-club px-1.5 py-[2px] text-[9px] text-club">Club</span>

  return (
    <div className={`space-y-4 ${className}`}>
      {!!from && (left > 0 ? (
        <div>
          <p className="text-[12px] text-muted">До бесплатной доставки — <span className="text-foreground">{formatPrice(left)}</span></p>
          <Bar pct={(total / from) * 100} />
        </div>
      ) : (
        <p className="flex items-center gap-2 text-[12px]"><span aria-hidden className="grid size-4 place-items-center rounded-full bg-foreground text-[9px] text-background">✓</span>Доставка бесплатная — до пункта СДЭК и Почтой России</p>
      ))}

      {guest && gTarget && (
        <div>
          <p className="text-[12px] text-muted">
            {gReached
              ? <>Этот заказ даст уровень <span className="text-foreground">{gReached.name} (−{gReached.discount}%)</span> на следующие покупки{tag}</>
              : <>До уровня {gTarget.name} (−{gTarget.discount}%) — ещё <span className="text-foreground">{formatPrice(gTarget.threshold - total)}</span>{tag}</>}
          </p>
          <Bar tone="club" pct={gReached ? 100 : (total / gTarget.threshold) * 100} />
          <p className="mt-2 text-[12px] text-muted">
            {!loy?.logged
              ? <><Link href="/account/login?next=/cart" className="text-foreground underline underline-offset-4">Авторизуйтесь</Link>, чтобы заказ засчитался в Laflamme Club</>
              : <>Укажите телефон в <Link href="/account" className="text-foreground underline underline-offset-4">профиле</Link>, чтобы заказ засчитался в Laflamme Club</>}
          </p>
        </div>
      )}
      {l?.enabled && l.confirmed && (
        <div>
          <p className="text-[12px] text-muted">
            {reached
              ? <>Этот заказ даст уровень <span className="text-foreground">{reached.name} (−{reached.discount}%)</span> на следующие покупки{tag}</>
              : nextAfter
                ? <>До уровня {nextAfter.name} (−{nextAfter.discount}%) — ещё <span className="text-foreground">{formatPrice(nextAfter.threshold - projected)}</span>{tag}</>
                : <>У вас высший уровень {l.level.name}{tag}</>}
          </p>
          {(reached || nextAfter) && <Bar tone="club" pct={reached ? 100 : (projected / nextAfter!.threshold) * 100} />}
        </div>
      )}
    </div>
  )
}
