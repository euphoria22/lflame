"use client"

import { createElement, useEffect, useState } from "react"

/**
 * Официальный бейдж Яндекс Сплита («4 платежа по …») — веб-элемент <yandex-pay-badge> из SDK Яндекс Пэй
 * (https://pay.yandex.ru/docs/ru/custom/web-sdk/badges). Показывается, только когда Сплит подключён
 * и задан Merchant ID (YANDEX_PAY_MERCHANT_ID на сервере); иначе ничего не выводит.
 */
type Opts = { split_payment?: boolean; split_merchant_id?: string | null }

let optsReq: Promise<Opts> | null = null
const loadOpts = (): Promise<Opts> => (optsReq ??= fetch("/api/checkout/options").then((r) => r.json() as Promise<Opts>).catch((): Opts => ({})))

let sdkReq: Promise<void> | null = null
function loadSdk(): Promise<void> {
  return (sdkReq ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script")
    // Яндекс просит подключать SDK только с их домена — актуальная версия с исправлениями
    s.src = "https://pay.yandex.ru/sdk/v1/pay.js"
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("SDK Яндекс Пэй не загрузился"))
    document.head.appendChild(s)
  }))
}

type Props = {
  amount: number
  /** Один товар (карточка, страница товара) */
  productId?: string
  /** Корзина: позиции и их суммы */
  cart?: { product_id: string; total: number }[]
  size?: "s" | "m" | "l"
  variant?: "simple" | "detailed"
  color?: "primary" | "green" | "grey" | "transparent"
  className?: string
}

export function SplitBadge({ amount, productId, cart, size = "s", variant = "simple", color = "transparent", className = "" }: Props) {
  const [merchant, setMerchant] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    loadOpts().then(async (o) => {
      if (!o.split_payment || !o.split_merchant_id) return
      await loadSdk()
      if (alive) setMerchant(o.split_merchant_id)
    }).catch(() => null)
    return () => { alive = false }
  }, [])
  if (!merchant || !(amount > 0)) return null
  return (
    <div className={className}>
      {createElement("yandex-pay-badge", {
        type: "bnpl",
        amount: amount.toFixed(2),
        "merchant-id": merchant,
        size,
        variant,
        color,
        theme: "light",
        ...(cart?.length ? { cart: JSON.stringify(cart.map((c) => ({ product_id: c.product_id, total: c.total.toFixed(2) }))) } : {}),
        ...(productId && !cart ? { "product-id": productId } : {}),
      })}
    </div>
  )
}
