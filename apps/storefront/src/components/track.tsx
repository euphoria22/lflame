"use client"

import { useEffect } from "react"

import { trackPurchase, trackView } from "@/lib/analytics"

/** Метрика: просмотр карточки товара. */
export function TrackView({ id, name, price, brand, category }: { id: string; name: string; price: number; brand?: string; category?: string }) {
  useEffect(() => { trackView({ id, name, price, brand, category }) }, [id, name, price, brand, category])
  return null
}

/** Метрика: покупка на странице «Заказ оформлен». */
export function TrackPurchase({ order }: { order: string }) {
  useEffect(() => { if (order) trackPurchase(order) }, [order])
  return null
}
