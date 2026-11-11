import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CheckCircle } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, DropdownMenu, Heading, Input, Select, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

type Flag = "preorder" | "is_new" | "pinned" | "outlet" | "no_loyalty"
type Row = {
  id: string; title: string; handle: string; thumbnail: string | null; status: string
  brand: string | null; category: string | null; created_at: string; flags: Record<Flag, boolean>
  has_description: boolean; images: number
}

const FLAGS: { key: Flag; label: string; color: "orange" | "green" | "blue" | "red" | "purple" }[] = [
  { key: "preorder", label: "Предзаказ", color: "orange" },
  { key: "is_new", label: "Новинка", color: "green" },
  { key: "pinned", label: "Закреплён наверху", color: "blue" },
  { key: "outlet", label: "Outlet", color: "red" },
  { key: "no_loyalty", label: "Без скидок Laflamme Club", color: "purple" },
]
const PAGE = 50
const ALL = "__all"

const SORTS: Record<string, { label: string; cmp: (a: Row, b: Row) => number }> = {
  new: { label: "Сначала новые", cmp: (a, b) => b.created_at.localeCompare(a.created_at) },
  old: { label: "Сначала старые", cmp: (a, b) => a.created_at.localeCompare(b.created_at) },
  title: { label: "По названию", cmp: (a, b) => a.title.localeCompare(b.title, "ru") },
  brand: { label: "По бренду", cmp: (a, b) => (a.brand ?? "яяя").localeCompare(b.brand ?? "яяя", "ru") || a.title.localeCompare(b.title, "ru") },
}

/** Массовая правка флажков сайта: фильтры, выбор товаров чекбоксами, включить или выключить флажок у всех выбранных. */
const SiteProductsPage = () => {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [flag, setFlag] = useState(ALL) // "preorder" — с флажком, "-preorder" — без
  const [brand, setBrand] = useState(ALL)
  const [category, setCategory] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [sort, setSort] = useState("new")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch("/admin/site-products", { credentials: "include" })
    if (!r.ok) throw new Error("Не удалось загрузить товары")
    setRows(((await r.json()) as { products: Row[] }).products)
  }, [])
  useEffect(() => { load().catch((e) => toast.error((e as Error).message)).finally(() => setLoading(false)) }, [load])

  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "ru")), [rows])
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "ru")), [rows])

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return rows
      .filter((r) => {
        if (words.length && !words.every((w) => `${r.title} ${r.brand ?? ""} ${r.handle}`.toLowerCase().includes(w))) return false
        if (flag === "no_description") { if (r.has_description) return false }
        else if (flag === "few_photos") { if (r.images < 1 || r.images > 2) return false }
        else if (flag === "no_photos") { if (r.images > 0) return false }
        else if (flag !== ALL) {
          const off = flag.startsWith("-")
          if (r.flags[flag.replace("-", "") as Flag] === off) return false
        }
        if (brand !== ALL && (brand === "" ? r.brand : r.brand !== brand)) return false
        if (category !== ALL && r.category !== category) return false
        if (status !== ALL && r.status !== status) return false
        return true
      })
      .sort(SORTS[sort].cmp)
  }, [rows, q, flag, brand, category, status, sort])

  useEffect(() => setPage(0), [q, flag, brand, category, status, sort])
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice(page * PAGE, page * PAGE + PAGE)
  const allShown = shown.length > 0 && shown.every((r) => selected.has(r.id))
  const someShown = shown.some((r) => selected.has(r.id))

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleShown = () => setSelected((s) => { const n = new Set(s); for (const r of shown) { if (allShown) n.delete(r.id); else n.add(r.id) } return n })

  const apply = async (key: Flag, value: boolean) => {
    const ids = [...selected]
    const name = FLAGS.find((f) => f.key === key)!.label
    if (!ids.length) return
    if (ids.length > 20 && !window.confirm(`${value ? "Включить" : "Выключить"} «${name}» у ${ids.length} товаров?`)) return
    setBusy(true)
    try {
      const r = await fetch("/admin/site-products/bulk", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, set: { [key]: value } }),
      })
      const d = (await r.json().catch(() => ({}))) as { updated?: number; message?: string }
      if (!r.ok) throw new Error(d.message ?? "Не сохранилось")
      setRows((all) => all.map((x) => (selected.has(x.id) ? { ...x, flags: { ...x.flags, [key]: value } } : x)))
      toast.success(`«${name}» ${value ? "включено" : "выключено"} у ${d.updated ?? ids.length} товаров — на сайте обновится в течение минуты`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sel = (value: string, set: (v: string) => void, placeholder: string, items: [string, string][]) => (
    <div className="w-48">
      <Select size="small" value={value} onValueChange={set}>
        <Select.Trigger><Select.Value placeholder={placeholder} /></Select.Trigger>
        <Select.Content>{items.map(([v, l]) => <Select.Item key={v || "none"} value={v || "__none"}>{l}</Select.Item>)}</Select.Content>
      </Select>
    </div>
  )

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="px-6 py-4">
        <Heading level="h1">Флажки товаров</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Отметьте товары и включите или выключите у всех сразу: предзаказ, новинка, закрепить наверху, Outlet, без скидок Laflamme Club.
          Описание дефекта для Outlet и дату предзаказа задайте в карточке товара.
          Фильтры «Без описания» и «Мало фото» помогают найти карточки, которые стоит дополнить.
        </Text>
      </Container>

      <Container className="p-0">
        <div className="flex flex-wrap items-center gap-2 px-6 py-4">
          <div className="w-64"><Input size="small" type="search" placeholder="Название, бренд" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {sel(flag, setFlag, "Флажок", [[ALL, "Все флажки"], ...FLAGS.flatMap((f): [string, string][] => [[f.key, `${f.label}: да`], [`-${f.key}`, `${f.label}: нет`]]),
            ["no_description", "Без описания"], ["few_photos", "Мало фото (1–2)"], ["no_photos", "Без фото"]])}
          {sel(brand === "" ? "__none" : brand, (v) => setBrand(v === "__none" ? "" : v), "Бренд", [[ALL, "Все бренды"], ["", "Без бренда"], ...brands.map((b): [string, string] => [b, b])])}
          {sel(category, setCategory, "Категория", [[ALL, "Все категории"], ...categories.map((c): [string, string] => [c, c])])}
          {sel(status, setStatus, "Статус", [[ALL, "Любой статус"], ["published", "Опубликован"], ["draft", "Черновик"]])}
          {sel(sort, setSort, "Сортировка", Object.entries(SORTS).map(([k, s]): [string, string] => [k, s.label]))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-ui-border-base px-6 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Найдено: {list.length}{selected.size ? ` · выбрано: ${selected.size}` : ""}
          </Text>
          {list.length > 0 && (
            <Button size="small" variant="transparent" onClick={() => setSelected(new Set(list.map((r) => r.id)))}>Выбрать все найденные ({list.length})</Button>
          )}
          {selected.size > 0 && <Button size="small" variant="transparent" onClick={() => setSelected(new Set())}>Снять выбор</Button>}
          <div className="ml-auto flex gap-2">
            <DropdownMenu>
              <DropdownMenu.Trigger asChild><Button size="small" disabled={!selected.size || busy} isLoading={busy}>Включить</Button></DropdownMenu.Trigger>
              <DropdownMenu.Content>{FLAGS.map((f) => <DropdownMenu.Item key={f.key} onClick={() => apply(f.key, true)}>{f.label}</DropdownMenu.Item>)}</DropdownMenu.Content>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild><Button size="small" variant="secondary" disabled={!selected.size || busy}>Выключить</Button></DropdownMenu.Trigger>
              <DropdownMenu.Content>{FLAGS.map((f) => <DropdownMenu.Item key={f.key} onClick={() => apply(f.key, false)}>{f.label}</DropdownMenu.Item>)}</DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-ui-border-base text-left text-ui-fg-subtle">
                <th className="w-10 px-6 py-2.5"><Checkbox checked={allShown ? true : someShown ? "indeterminate" : false} onCheckedChange={toggleShown} /></th>
                <th className="py-2.5 pr-3 font-medium">Товар</th>
                <th className="py-2.5 pr-3 font-medium">Бренд</th>
                <th className="py-2.5 pr-3 font-medium">Категория</th>
                <th className="py-2.5 pr-6 font-medium">Флажки и пометки</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-6 py-8 text-ui-fg-subtle">Загрузка…</td></tr>}
              {!loading && !shown.length && <tr><td colSpan={5} className="px-6 py-8 text-ui-fg-subtle">Ничего не найдено</td></tr>}
              {shown.map((r) => (
                <tr key={r.id} className={`border-t border-ui-border-base hover:bg-ui-bg-base-hover ${selected.has(r.id) ? "bg-ui-bg-highlight" : ""}`}>
                  <td className="px-6 py-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                  <td className="max-w-[420px] py-2 pr-3">
                    <a href={`/app/products/${r.id}`} className="flex items-center gap-3 text-ui-fg-base hover:underline">
                      <span className="h-8 w-6 shrink-0 overflow-hidden rounded bg-ui-bg-component">
                        {r.thumbnail && <img src={r.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      </span>
                      <span className="truncate">{r.title}</span>
                      {r.status !== "published" && <Badge size="2xsmall">черновик</Badge>}
                    </a>
                  </td>
                  <td className="py-2 pr-3 text-ui-fg-subtle">{r.brand ?? "—"}</td>
                  <td className="py-2 pr-3 text-ui-fg-subtle">{r.category ?? "—"}</td>
                  <td className="py-2 pr-6">
                    <div className="flex flex-wrap gap-1">
                      {FLAGS.filter((f) => r.flags[f.key]).map((f) => <Badge key={f.key} size="2xsmall" color={f.color}>{f.label}</Badge>)}
                      {!r.has_description && <Badge size="2xsmall" color="grey">Без описания</Badge>}
                      {r.images === 0 ? <Badge size="2xsmall" color="grey">Без фото</Badge>
                        : r.images <= 2 && <Badge size="2xsmall" color="grey">Фото: {r.images}</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-ui-border-base px-6 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            {list.length ? `${page * PAGE + 1} — ${Math.min(list.length, page * PAGE + PAGE)} из ${list.length}` : "0"}
          </Text>
          <div className="flex items-center gap-2">
            <Text size="small" className="text-ui-fg-subtle">{page + 1} из {pages}</Text>
            <Button size="small" variant="transparent" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Назад</Button>
            <Button size="small" variant="transparent" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Далее</Button>
          </div>
        </div>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Флажки товаров", icon: CheckCircle })

export default SiteProductsPage
