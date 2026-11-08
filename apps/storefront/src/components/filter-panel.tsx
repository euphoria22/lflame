"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { formatPrice, plural } from "@/lib/format"
import { sizeKind } from "@/lib/size-groups"
import { filtersToQuery, ListingFilters, ListingResult, SORTS, SortKey, withQuery } from "@/lib/listing"
import { ChevronIcon, CloseIcon, FilterIcon } from "./icons"

type Props = {
  basePath: string
  filters: ListingFilters
  facets: ListingResult["facets"]
  total: number
  /** На странице бренда фильтр по бренду не нужен */
  showBrands: boolean
  /** В категории фильтр по категории не нужен */
  showCategories: boolean
  /** sidebar — колонка слева (десктоп); toolbar — строка над сеткой и панель на телефоне */
  mode: "sidebar" | "toolbar"
  /** Переключатель «Все / Мужское / Женское» в верху фильтра */
  genderLinks?: { label: string; href: string; active?: boolean }[]
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
export function FilterPanel({ basePath, filters, facets, total, showBrands, showCategories, mode, genderLinks }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  const go = (next: Partial<ListingFilters>) => {
    const url = withQuery(basePath, filtersToQuery({ ...filters, ...next, page: 1 }))
    start(() => router.push(url, { scroll: false }))
  }
  const toggle = (key: "categories" | "brands" | "sizes" | "colors", value: string) => {
    const cur = filters[key]
    go({ [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] })
  }
  const active = filters.categories.length + filters.brands.length + filters.sizes.length + filters.colors.length + (filters.priceMin || filters.priceMax ? 1 : 0)

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : ""
    return () => { document.documentElement.style.overflow = "" }
  }, [open])

  const brandsShown = showBrands && facets.brands.length > 1
  // fill — колонка на десктопе растянута до низа экрана, блок брендов занимает остаток высоты
  const body = (fill: boolean) => (
    <div className={`flex flex-col gap-8 ${fill ? "h-full" : ""} ${pending ? "opacity-60" : ""}`}>
      {!!genderLinks?.length && (
        <nav aria-label="Раздел" className="flex rounded-full bg-surface p-1 text-[13px]">
          {genderLinks.map((g) => (
            <Link key={g.href} href={g.href} aria-current={g.active ? "page" : undefined}
              className={`flex-1 rounded-full py-2 text-center transition-colors ${g.active ? "bg-background shadow-sm" : "text-muted hover:text-foreground"}`}>
              {g.label}
            </Link>
          ))}
        </nav>
      )}

      {showCategories && facets.categories.length > 1 && (
        <Group title="Категория">
          <ul className="max-h-44 space-y-2 overflow-y-auto scroll-subtle pr-1">
            {facets.categories.map((c) => (
              <li key={c.value}>
                <Check checked={filters.categories.includes(c.value)} onChange={() => toggle("categories", c.value)} label={c.label} count={c.count} />
              </li>
            ))}
          </ul>
        </Group>
      )}

      <PriceFilter key={`${filters.priceMin}-${filters.priceMax}`} min={facets.price.min} max={facets.price.max}
        valueMin={filters.priceMin} valueMax={filters.priceMax}
        onApply={(priceMin, priceMax) => go({ priceMin, priceMax })} />

      {facets.sizes.length > 0 && (
        <Group title="Размер">
          <SizeFilter facets={facets.sizes} selected={filters.sizes} onToggle={(v) => toggle("sizes", v)} />
        </Group>
      )}

      {facets.colors.length > 0 && (
        <Group title="Цвет">
          <ul className="max-h-40 space-y-2 overflow-y-auto scroll-subtle pr-1">
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

      {brandsShown && <BrandFilter fill={fill} facets={facets.brands} selected={filters.brands} onToggle={(v) => toggle("brands", v)} />}

      {active > 0 && (
        <button type="button" onClick={() => go({ categories: [], brands: [], sizes: [], colors: [], priceMin: null, priceMax: null })} className="eyebrow self-start underline underline-offset-4">
          Сбросить фильтры
        </button>
      )}
    </div>
  )

  if (mode === "sidebar") {
    return (
      // h-full: закреплённому блоку нужен родитель во всю высоту каталога, иначе ему некуда ехать
      <aside aria-label="Фильтры" className="hidden h-full lg:block">
        {brandsShown ? (
          // Высота — до низа экрана: без пустого места снизу; бренды заполняют остаток
          <div className="scroll-subtle sticky top-[96px] h-[calc(100vh-112px)] overflow-y-auto pb-4 pl-8 pr-4">{body(true)}</div>
        ) : (
          <SmartSticky>{body(false)}</SmartSticky>
        )}
      </aside>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 py-2 text-[13px] lg:hidden">
          <FilterIcon className="size-4" /> Фильтр{active ? ` · ${active}` : ""}
        </button>
        <p className="hidden text-[13px] text-muted lg:block">{total} {plural(total, ["товар", "товара", "товаров"])}</p>
        <label className="relative flex items-center text-[13px]">
          <span className="text-muted">Сортировка:&nbsp;</span>
          <select value={filters.sort} onChange={(e) => go({ sort: e.target.value as SortKey })}
            className="cursor-pointer appearance-none bg-transparent py-2 pr-6 text-[13px] outline-none">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <ChevronIcon className="pointer-events-none absolute right-0 size-4" />
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
            <div className="overflow-y-auto px-5 pb-4 pt-2">{body(false)}</div>
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

/**
 * «Умное» закрепление: если фильтр помещается в экран — закреплён сверху под шапкой;
 * если выше экрана — сначала прокручивается со страницей и закрепляется нижним краем,
 * чтобы нижние группы (бренды) всегда были доступны.
 */
const HEADER_OFFSET = 96

function SmartSticky({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(HEADER_OFFSET)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setTop(Math.min(HEADER_OFFSET, window.innerHeight - el.offsetHeight - 16))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener("resize", update)
    return () => { ro.disconnect(); window.removeEventListener("resize", update) }
  }, [])

  return <div ref={ref} className="sticky pb-8 pl-8 pr-4" style={{ top }}>{children}</div>
}

/**
 * Размеры (обратная связь 08.11.2026): слева одежда XS–3XL, затем One Size и прочие;
 * справа джинсы по талии; ниже обувь в два столбца. Общая прокрутка внутри блока.
 */
function SizeFilter({ facets, selected, onToggle }: { facets: ListingResult["facets"]["sizes"]; selected: string[]; onToggle: (v: string) => void }) {
  const by = (kinds: string[]) => facets.filter((s) => kinds.includes(sizeKind(s.value)))
  const left = [...by(["letter"]), ...by(["one"]), ...by(["other"])]
  const right = by(["waist"])
  const shoes = by(["shoe"])
  const item = (s: { value: string; label: string }) => (
    <li key={s.value}><Check checked={selected.includes(s.value)} onChange={() => onToggle(s.value)} label={s.label} /></li>
  )
  const cols = left.length && right.length
  return (
    <div className="max-h-52 overflow-y-auto scroll-subtle pr-1">
      {(left.length > 0 || right.length > 0) && (
        <div className={cols ? "grid grid-cols-2 gap-x-4" : ""}>
          {left.length > 0 && <ul className={cols ? "space-y-2" : "grid grid-cols-2 gap-x-4 gap-y-2"}>{left.map(item)}</ul>}
          {right.length > 0 && <ul className={cols ? "space-y-2" : "grid grid-cols-2 gap-x-4 gap-y-2"}>{right.map(item)}</ul>}
        </div>
      )}
      {shoes.length > 0 && (
        <>
          {(left.length > 0 || right.length > 0) && <p className="mb-2 mt-4 text-[12px] text-muted">Обувь</p>}
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2">{shoes.map(item)}</ul>
        </>
      )}
    </div>
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

function BrandFilter({ facets, selected, onToggle, fill }: { facets: ListingResult["facets"]["brands"]; selected: string[]; onToggle: (v: string) => void; fill: boolean }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(true)
  const shown = useMemo(() => facets.filter((b) => b.label.toLowerCase().includes(q.toLowerCase())), [facets, q])
  return (
    <div className={fill && open ? "flex min-h-[160px] flex-1 flex-col" : ""}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="mb-3 flex w-full items-center justify-between text-left text-[13px] font-medium">
        Бренд
        <ChevronIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          {facets.length > 8 && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск бренда"
              className="mb-3 w-full border-b border-line bg-transparent py-2 text-[13px] outline-none focus:border-foreground" />
          )}
          <ul className={`scroll-subtle space-y-2 overflow-y-auto pr-1 ${fill ? "min-h-0 flex-1" : "max-h-44"}`}>
            {shown.map((b) => (
              <li key={b.value}>
                <Check checked={selected.includes(b.value)} onChange={() => onToggle(b.value)} label={b.label} count={b.count} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function PriceFilter({ min, max, valueMin, valueMax, onApply }: {
  min: number; max: number; valueMin: number | null; valueMax: number | null
  onApply: (min: number | null, max: number | null) => void
}) {
  // Шаг 100 ₽; ползунок с двумя ручками из двух input[type=range]
  const lo0 = Math.floor(min / 100) * 100
  const hi0 = Math.ceil(max / 100) * 100
  const [lo, setLo] = useState(valueMin ?? lo0)
  const [hi, setHi] = useState(valueMax ?? hi0)
  if (hi0 <= lo0) return null
  const pct = (v: number) => ((v - lo0) / (hi0 - lo0)) * 100
  const commit = () => onApply(lo > lo0 ? lo : null, hi < hi0 ? hi : null)
  const thumb = "pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:bg-background [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-foreground [&::-moz-range-thumb]:bg-background"
  return (
    <Group title="Цена">
      <div className="flex justify-between text-[13px]">
        <span>{formatPrice(lo)}</span>
        <span>{formatPrice(hi)}</span>
      </div>
      <div className="relative mx-2 mt-4 h-4">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <div className="absolute top-1/2 h-px -translate-y-1/2 bg-foreground" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" aria-label="Цена от" min={lo0} max={hi0} step={100} value={lo}
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi - 100))}
          onPointerUp={commit} onKeyUp={commit} onTouchEnd={commit} className={thumb} />
        <input type="range" aria-label="Цена до" min={lo0} max={hi0} step={100} value={hi}
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo + 100))}
          onPointerUp={commit} onKeyUp={commit} onTouchEnd={commit} className={thumb} />
      </div>
    </Group>
  )
}

/** Квадратная галочка в стиле сайта. */
function Check({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
      <input type="checkbox" checked={checked} onChange={onChange}
        className="size-4 shrink-0 cursor-pointer appearance-none border border-subtle bg-background bg-center bg-no-repeat checked:border-foreground checked:bg-foreground checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M4 8.5l2.5 2.5L12 5.5%22 fill=%22none%22 stroke=%22white%22 stroke-width=%221.6%22/></svg>')]" />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-subtle">{count}</span>}
    </label>
  )
}
