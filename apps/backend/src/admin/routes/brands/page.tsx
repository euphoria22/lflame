import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

type Brand = {
  id: string; name: string; handle: string; is_active: boolean; aliases: string[]
  short_description: string | null; description: string | null
  seo_title: string | null; seo_description: string | null; seo_text: string | null
  products: number
}
type Form = Omit<Brand, "id" | "handle" | "products" | "aliases"> & { aliases: string }

const SITE = "https://laflamme.ru"
const toForm = (b: Brand): Form => ({
  name: b.name, is_active: b.is_active, aliases: b.aliases.join(", "),
  short_description: b.short_description ?? "", description: b.description ?? "",
  seo_title: b.seo_title ?? "", seo_description: b.seo_description ?? "", seo_text: b.seo_text ?? "",
})

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: body ? "POST" : "GET", credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as { message?: string }).message ?? "Не получилось")
  return d as T
}

/** Бренды сайта: название, тексты для страницы бренда и поиска, видимость, объединение написаний. */
const BrandsPage = () => {
  const [brands, setBrands] = useState<Brand[]>([])
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [mergeInto, setMergeInto] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const d = await api<{ brands: Brand[] }>("/admin/site-brands")
    setBrands(d.brands)
    return d.brands
  }, [])
  useEffect(() => { load().catch((e) => toast.error((e as Error).message)) }, [load])

  const brand = brands.find((b) => b.id === selected) ?? null
  const pick = (b: Brand) => { setSelected(b.id); setForm(toForm(b)); setMergeInto("") }
  const list = useMemo(() => brands.filter((b) => !q || `${b.name} ${b.aliases.join(" ")}`.toLowerCase().includes(q.toLowerCase())), [brands, q])
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f))

  const save = async () => {
    if (!brand || !form) return
    setBusy(true)
    try {
      await api(`/admin/site-brands/${brand.id}`, { ...form, aliases: form.aliases.split(",").map((a) => a.trim()).filter(Boolean) })
      const fresh = await load()
      const b = fresh.find((x) => x.id === brand.id)
      if (b) setForm(toForm(b))
      toast.success("Сохранено — на сайте обновится в течение минуты")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const merge = async () => {
    if (!brand || !mergeInto) return
    const into = brands.find((b) => b.id === mergeInto)
    if (!into || !window.confirm(`Объединить «${brand.name}» с «${into.name}»? Товары (${brand.products}) перейдут в «${into.name}», бренд «${brand.name}» будет удалён.`)) return
    setBusy(true)
    try {
      const r = await api<{ moved: number }>(`/admin/site-brands/${brand.id}/merge`, { into: mergeInto })
      const fresh = await load()
      const b = fresh.find((x) => x.id === mergeInto)
      if (b) pick(b)
      toast.success(`Объединено, перенесено товаров: ${r.moved}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="px-6 py-4">
        <Heading level="h1">Бренды</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Бренды создаются сами из поля «Бренд» в МоёмСкладе. Здесь — как бренд выглядит на сайте: название, тексты страницы бренда, видимость.
          Если один бренд записан по-разному (опечатка, другое написание) — объедините их.
        </Text>
      </Container>

      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Container className="p-0">
          <div className="px-4 py-3"><Input placeholder="Найти бренд" value={q} onChange={(e) => setQ(e.target.value)} size="small" /></div>
          <div className="max-h-[70vh] overflow-y-auto">
            {list.map((b) => (
              <button key={b.id} type="button" onClick={() => pick(b)}
                className={`flex w-full items-center justify-between gap-2 border-t border-ui-border-base px-4 py-2.5 text-left text-sm hover:bg-ui-bg-base-hover ${b.id === selected ? "bg-ui-bg-base-pressed" : ""}`}>
                <span className={`truncate ${b.is_active ? "text-ui-fg-base" : "text-ui-fg-muted line-through"}`}>{b.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {!b.seo_text && b.products > 0 && <Badge size="2xsmall" color="orange">нет текста</Badge>}
                  <span className="text-ui-fg-subtle">{b.products}</span>
                </span>
              </button>
            ))}
          </div>
        </Container>

        {!brand || !form ? (
          <Container className="px-6 py-10"><Text className="text-ui-fg-subtle">Выберите бренд слева.</Text></Container>
        ) : (
          <div className="flex flex-col gap-3">
            <Container className="divide-y p-0">
              <div className="flex items-center justify-between gap-3 px-6 py-4">
                <div>
                  <Heading level="h2">{brand.name}</Heading>
                  <Text size="small" className="text-ui-fg-subtle">{brand.products} товаров · <a href={`${SITE}/brands/${brand.handle}`} target="_blank" rel="noreferrer" className="underline">страница на сайте</a></Text>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="b-active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label htmlFor="b-active">Показывать на сайте</Label>
                </div>
              </div>
              <div className="grid gap-4 px-6 py-4">
                <div>
                  <Label htmlFor="b-name">Название на сайте</Label>
                  <Input id="b-name" className="mt-1" value={form.name} onChange={set("name")} />
                  <Text size="xsmall" className="mt-1 text-ui-fg-muted">Прежнее название сохранится в «других написаниях» — товары из МоегоСклада продолжат попадать в этот бренд.</Text>
                </div>
                <div>
                  <Label htmlFor="b-aliases">Другие написания (через запятую)</Label>
                  <Input id="b-aliases" className="mt-1" value={form.aliases} onChange={set("aliases")} placeholder="Например: CP Company, C.P Company" />
                  <Text size="xsmall" className="mt-1 text-ui-fg-muted">Так бренд может быть записан в МоёмСкладе или в названии товара.</Text>
                </div>
                <div>
                  <Label htmlFor="b-short">Короткое описание — вверху страницы бренда</Label>
                  <Textarea id="b-short" className="mt-1" rows={2} value={form.short_description ?? ""} onChange={set("short_description")} />
                </div>
                <div>
                  <Label htmlFor="b-desc">О бренде — в карточке товара</Label>
                  <Textarea id="b-desc" className="mt-1" rows={4} value={form.description ?? ""} onChange={set("description")} />
                </div>
                <div>
                  <Label htmlFor="b-seo">SEO-текст — внизу страницы бренда (2–4 абзаца, абзацы через пустую строку)</Label>
                  <Textarea id="b-seo" className="mt-1" rows={8} value={form.seo_text ?? ""} onChange={set("seo_text")} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="b-st">Заголовок для поиска (title)</Label>
                    <Input id="b-st" className="mt-1" value={form.seo_title ?? ""} onChange={set("seo_title")} placeholder={`${brand.name} — одежда и обувь, купить`} />
                  </div>
                  <div>
                    <Label htmlFor="b-sd">Описание для поиска (description)</Label>
                    <Input id="b-sd" className="mt-1" value={form.seo_description ?? ""} onChange={set("seo_description")} placeholder="Если пусто — составится автоматически" />
                  </div>
                </div>
                <div><Button isLoading={busy} onClick={save}>Сохранить</Button></div>
              </div>
            </Container>

            <Container className="px-6 py-4">
              <Heading level="h2">Объединить с другим брендом</Heading>
              <Text size="small" className="text-ui-fg-subtle">Если «{brand.name}» — это опечатка или другое написание существующего бренда: товары перейдут туда, «{brand.name}» станет его написанием и будет удалён.</Text>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="w-72">
                  <Select value={mergeInto} onValueChange={setMergeInto}>
                    <Select.Trigger><Select.Value placeholder="Основной бренд" /></Select.Trigger>
                    <Select.Content>
                      {brands.filter((b) => b.id !== brand.id).map((b) => <Select.Item key={b.id} value={b.id}>{b.name} ({b.products})</Select.Item>)}
                    </Select.Content>
                  </Select>
                </div>
                <Button variant="secondary" disabled={!mergeInto} isLoading={busy} onClick={merge}>Объединить</Button>
              </div>
            </Container>
          </div>
        )}
      </div>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Бренды", icon: Tag })

export default BrandsPage
