"use client"

import "leaflet/dist/leaflet.css"

import type { Map as LMap, Marker } from "leaflet"
import { useEffect, useRef } from "react"

export type MapPoint = { id: string; lat: number; lon: number; title: string }

type Props = {
  points: MapPoint[]
  selected?: string
  onSelect: (id: string) => void
}

/**
 * Карта пунктов выдачи (Leaflet + OpenStreetMap, без ключей).
 * Подложку можно заменить: NEXT_PUBLIC_MAP_TILES (шаблон адреса плиток) и NEXT_PUBLIC_MAP_ATTRIBUTION.
 */
const TILES = process.env.NEXT_PUBLIC_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "© участники OpenStreetMap"

const icon = (on: boolean) =>
  `<span class="lf-pin${on ? " lf-pin--on" : ""}"></span>`

export function PickupMap({ points, selected, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<LMap | null>(null)
  const markers = useRef<Map<string, Marker>>(new Map())
  const L = useRef<typeof import("leaflet") | null>(null)
  const pick = useRef(onSelect)
  useEffect(() => { pick.current = onSelect }, [onSelect])

  // Карта и маркеры: пересоздаются при смене набора точек (другой город)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const leaflet = L.current ?? (L.current = await import("leaflet"))
      if (cancelled || !box.current) return
      if (!map.current) {
        map.current = leaflet.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false })
        leaflet.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map.current)
        map.current.attributionControl.setPrefix(false)
        // Колесо мыши масштабирует только после клика по карте, чтобы не мешать прокрутке страницы
        map.current.on("click", () => map.current?.scrollWheelZoom.enable())
        map.current.on("mouseout", () => map.current?.scrollWheelZoom.disable())
      }
      markers.current.forEach((m) => m.remove())
      markers.current.clear()
      const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && (p.lat || p.lon))
      for (const p of valid) {
        const m = leaflet
          .marker([p.lat, p.lon], { icon: leaflet.divIcon({ className: "", html: icon(false), iconSize: [22, 22], iconAnchor: [11, 11] }), title: p.title, keyboard: true })
          .on("click", () => pick.current(p.id))
          .addTo(map.current)
        markers.current.set(p.id, m)
      }
      map.current.invalidateSize()
      if (valid.length) {
        map.current.fitBounds(leaflet.latLngBounds(valid.map((p) => [p.lat, p.lon] as [number, number])), { padding: [24, 24], maxZoom: 15 })
      }
    })()
    return () => { cancelled = true }
  }, [points])

  // Выделение выбранного пункта и перелёт к нему
  useEffect(() => {
    const leaflet = L.current
    if (!leaflet || !map.current) return
    markers.current.forEach((m, id) => {
      const on = id === selected
      m.setIcon(leaflet.divIcon({ className: "", html: icon(on), iconSize: on ? [30, 30] : [22, 22], iconAnchor: on ? [15, 15] : [11, 11] }))
      m.setZIndexOffset(on ? 1000 : 0)
      // Двигаем карту, только если выбранный пункт за краем (выбор из списка)
      if (on && !map.current?.getBounds().pad(-0.1).contains(m.getLatLng())) map.current?.panTo(m.getLatLng(), { animate: true })
    })
  }, [selected, points])

  // Размер блока меняется (сетка, вкладки «На карте / Списком») — Leaflet нужно пересчитать
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(() => map.current?.invalidateSize())
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => () => { map.current?.remove(); map.current = null }, [])

  return <div ref={box} className="lf-map h-[320px] w-full overflow-hidden rounded-xl border border-line md:h-[380px]" role="application" aria-label="Карта пунктов выдачи" />
}
