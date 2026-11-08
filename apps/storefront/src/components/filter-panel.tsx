"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"

import { formatPrice, plural } from "@/lib/format"
import { filtersToQuery, ListingFilters, ListingResult, SORTS, SortKey, withQuery } from "@/lib/listing"
import { ChevronIcon, CloseIcon, FilterIcon } from "./icons"

type Props = {
  basePath: string
  filters: ListingFilters
  facets: ListingResult["facets"]
  total: number
  /** На странице бренда фильтр по бренду не нужен */
  showBrands: boolean
  /** sidebar — колонка слева (десктоп); toolbar — строка над сеткой и панель на телефоне */
  mode: "sidebar" | "toolbar"
}

/** Цвет кружка в фильтре цвета. */
const SWATCH: Record<string, string> = {
  black: "#111", white: "#fff", grey: "#9ca3af", blue: "#1e3a8a", "light-blue": "#93c5fd", green: "#3f6212",
  khaki: "#8a8a5c", beige: "#d6c7a7", brown: "#6b4226", red: "#c4161c", burgundy: "#6d1a2a", pink: "#f4a7b9",
  orange: "#f97316", yellow: "#facc15", purple: "#7e22ce", silver: "#d4d4d8", gold: "#d4af37",
  multi: "conic-gradient(#f43f5e, #f59e0b, #22c55e, #3b82f6, #a855f7, #f43f5e)",
}

/**
 * Фильтры и сортировка (ТЗ, п. 6.2). Десктоп — колонка слева, телефон — стеклянная панель снизу.
 * Изменение фильтра меняет адрес: параметры не индексируются, canonical — на страницу без них (п. 7.3).
 */
export function FilterPanel({ basePath, filters, facets, total, showBrands, mode }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  const go = (next: Partial<ListingFilters>) => {
    const url = withQuery(basePath, filtersToQuery({ ...filters, ...next, page: 1 }))
    start(() => router.push(url, { scroll: false }))
  }
  const toggle = (key: "brands" | "sizes" | "colors", value: string) => {
    const cur = filters[key]
    go({ [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] })
  }
  const active = filters.brands.length + filters.sizes.length + filters.colors.length + (filters.priceMin || filters.priceMax ? 1 : 0)

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : ""
    return () => { document.documentElement.style.overflow = "" }
  }, [open])

  const body = (
    <div className={`flex flex-col gap-8 ${pending ? "opacity-60" : ""}`}>
      <PriceFilter key={`${filters.priceMin}-${filters.priceMax}`} min={facets.price.min} max={facets.price.max}
        valueMin={filters.priceMin} valueMax={filters.priceMax}
        onApply={(priceMin, priceMax) => go({ priceMin, priceMax })} />

      {facets.sizes.length > 0 && (
        <Group title="Размер">
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((s) => {
              const on = filters.sizes.includes(s.value)
              return (
                <button key={s.value} type="button" onClick={() => toggle("sizes", s.value)} aria-pressed={on}
                  className={`h-9 min-w-[52px] rounded-full border px-3 text-[12px] transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground"}`}>
                  {s.label}
                </button>
              )
            })}
          </div>
        </Group>
      )}

      {facets.colors.length > 0 && (
        <Group title="Цвет">
          <ul className="space-y-2">
            {facets.colors.map((c) => {
              const on = filters.colors.includes(c.value)
              return (
                <li key={c.value}>
                  <button type="button" onClick={() => toggle("colors", c.value)} aria-pressed={on} className="flex w-full items-center gap-3 text-left text-[13px]">
                    <span className={`size-5 rounded-full border ${on ? "ring-2 ring-foreground ring-offset-2" : "border-line"}`} style={{ background: SWATCH[c.value] ?? "#ccc" }} />
                    <span className="flex-1">{c.label}</span>
                    <span className="text-subtle">{c.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Group>
      )}

      {showBrands && facets.brands.length > 1 && <BrandFilter facets={facets.brands} selected={filters.brands} onToggle={(v) => toggle("brands", v)} />}

      {active > 0 && (
        <button type="button" onClick={() => go({ brands: [], sizes: [], colors: [], priceMin: null, priceMax: null })} className="eyebrow self-start underline underline-offset-4">
          Сбросить фильтры
        </button>
      )}
    </div>
  )

  if (mode === "sidebar") {
    return (
      <aside aria-label="Фильтры" className="hidden lg:block">
        <div className="sticky top-[96px] max-h-[calc(100vh-110px)] overflow-y-auto pb-8 pl-8 pr-4">{body}</div>
      </aside>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] lg:hidden">
          <FilterIcon className="size-4" /> Фильтр{active ? ` · ${active}` : ""}
        </button>
        <p className="hidden text-[13px] text-muted lg:block">{total} {plural(total, ["товар", "товара", "товаров"])}</p>
        <label className="relative flex items-center gap-2 text-[13px]">
          <span className="sr-only">Сортировка</span>
          <select value={filters.sort} onChange={(e) => go({ sort: e.target.value as SortKey })}
            className="appearance-none rounded-full border border-line bg-transparent py-2 pl-4 pr-9 text-[13px]">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <ChevronIcon className="pointer-events-none absolute right-3 size-4" />
        </label>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Фильтры">
          <div className="absolute inset-0 bg-black/25" onClick={() => setOpen(false)} />
          <div className="glass-strong absolute inset-x-2 bottom-2 flex max-h-[85vh] flex-col rounded-[28px]">
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <p className="text-[17px]">Фильтры</p>
              <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-black/5"><CloseIcon className="size-6" /></button>
            </div>
            <div className="overflow-y-auto px-5 pb-4 pt-2">{body}</div>
            <div className="p-3">
              <button type="button" onClick={() => setOpen(false)} className="h-12 w-full rounded-full bg-foreground text-[14px] text-background">
                Показать {total}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group/f">
      <summary className="mb-3 flex items-center justify-between text-[13px] font-medium">
        {title}
        <ChevronIcon className="size-4 transition-transform group-open/f:rotate-180" />
      </summary>
      {children}
    </details>
  )
}

function BrandFilter({ facets, selected, onToggle }: { facets: ListingResult["facets"]["brands"]; selected: string[]; onToggle: (v: string) => void }) {
  const [q, setQ] = useState("")
  const shown = useMemo(() => facets.filter((b) => b.label.toLowerCase().includes(q.toLowerCase())), [facets, q])
  return (
    <Group title="Бренд">
      {facets.length > 8 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск бренда"
          className="mb-3 h-9 w-full rounded-full border border-line px-4 text-[13px] outline-none focus:border-foreground" />
      )}
      <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {shown.map((b) => {
          const on = selected.includes(b.value)
          return (
            <li key={b.value}>
              <label className="flex cursor-pointer items-center gap-3 text-[13px]">
                <input type="checkbox" checked={on} onChange={() => onToggle(b.value)} className="size-4 accent-black" />
                <span className="flex-1">{b.label}</span>
                <span className="text-subtle">{b.count}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </Group>
  )
}

function PriceFilter({ min, max, valueMin, valueMax, onApply }: {
  min: number; max: number; valueMin: number | null; valueMax: number | null
  onApply: (min: number | null, max: number | null) => void
}) {
  const [lo, setLo] = useState(valueMin ? String(valueMin) : "")
  const [hi, setHi] = useState(valueMax ? String(valueMax) : "")
  const apply = () => onApply(Number(lo) || null, Number(hi) || null)
  const field = "h-9 w-full rounded-full border border-line px-4 text-[13px] outline-none focus:border-foreground"
  return (
    <Group title="Цена">
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); apply() }}>
        <input inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value.replace(/\D/g, ""))} onBlur={apply} placeholder={`от ${formatPrice(min)}`} aria-label="Цена от" className={field} />
        <input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value.replace(/\D/g, ""))} onBlur={apply} placeholder={`до ${formatPrice(max)}`} aria-label="Цена до" className={field} />
      </form>
    </Group>
  )
}
