import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Label, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useState } from "react"

type Flags = { preorder: boolean; no_loyalty: boolean; preorder_date: string | null; outlet: boolean; outlet_note: string | null }
type Patch = Partial<Flags>

/** Флажки товара для сайта: предзаказ (с ожидаемой датой поступления), Outlet (с описанием дефекта) и исключение из программы лояльности. */
const ProductFlagsWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const m = product.metadata ?? {}
  const [preorder, setPreorder] = useState(Boolean(m.preorder))
  const [noLoyalty, setNoLoyalty] = useState(Boolean(m.no_loyalty))
  const [date, setDate] = useState(typeof m.preorder_date === "string" ? m.preorder_date : "")
  const [savedDate, setSavedDate] = useState(date)
  const [outlet, setOutlet] = useState(Boolean(m.outlet))
  const [note, setNote] = useState(typeof m.outlet_note === "string" ? m.outlet_note : "")
  const [savedNote, setSavedNote] = useState(note)
  const [busy, setBusy] = useState(false)

  const save = async (patch: Patch) => {
    setBusy(true)
    try {
      const r = await fetch(`/admin/product-flags/${product.id}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      })
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "Не сохранилось")
      const d = (await r.json()) as Flags
      setPreorder(d.preorder)
      setNoLoyalty(d.no_loyalty)
      setDate(d.preorder_date ?? "")
      setSavedDate(d.preorder_date ?? "")
      setOutlet(d.outlet)
      setNote(d.outlet_note ?? "")
      setSavedNote(d.outlet_note ?? "")
      toast.success("Сохранено — на сайте обновится в течение минуты")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4"><Heading level="h2">Продажа на сайте</Heading></div>
      <div className="flex flex-col gap-y-5 px-6 py-4">
        <div className="flex items-start gap-3">
          <Switch id="lf-preorder" className="mt-0.5 shrink-0" checked={preorder} disabled={busy} onCheckedChange={(v) => save({ preorder: v })} />
          <div className="min-w-0 flex-1">
            <Label htmlFor="lf-preorder" weight="plus">Предзаказ</Label>
            <Text size="small" className="text-ui-fg-subtle">Товар в пути: продаётся по остатку из МоегоСклада, как обычно. На сайте — пометка «Предзаказ» и кнопка «Оформить предзаказ».</Text>
            {preorder && (
              <div className="mt-3">
                <Label htmlFor="lf-preorder-date" size="small">Ожидаемая дата поступления</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input id="lf-preorder-date" type="date" size="small" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} className="w-40" />
                  {date !== savedDate && <Button size="small" variant="secondary" isLoading={busy} onClick={() => save({ preorder_date: date || null })}>Сохранить</Button>}
                  {date && date === savedDate && <Button size="small" variant="transparent" disabled={busy} onClick={() => save({ preorder_date: null })}>Убрать</Button>}
                </div>
                <Text size="xsmall" className="mt-1 text-ui-fg-muted">На сайте: «Предзаказ · 15 декабря». Пусто — без даты.</Text>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Switch id="lf-outlet" className="mt-0.5 shrink-0" checked={outlet} disabled={busy} onCheckedChange={(v) => save({ outlet: v })} />
          <div className="min-w-0 flex-1">
            <Label htmlFor="lf-outlet" weight="plus">Outlet</Label>
            <Text size="small" className="text-ui-fg-subtle">Вещь с небольшим дефектом: попадает в раздел Outlet, на сайте — пометка и описание дефекта. Цену со скидкой задайте в МоёмСкладе, как обычно.</Text>
            {outlet && (
              <div className="mt-3">
                <Label htmlFor="lf-outlet-note" size="small">Что за дефект</Label>
                <Textarea id="lf-outlet-note" className="mt-1" rows={2} maxLength={300} value={note} disabled={busy}
                  placeholder="Например: затяжка на рукаве, не влияет на носку" onChange={(e) => setNote(e.target.value)} />
                {note !== savedNote && <Button size="small" variant="secondary" className="mt-2" isLoading={busy} onClick={() => save({ outlet_note: note.trim() || null })}>Сохранить</Button>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Switch id="lf-noloyalty" className="mt-0.5 shrink-0" checked={noLoyalty} disabled={busy} onCheckedChange={(v) => save({ no_loyalty: v })} />
          <div className="min-w-0 flex-1">
            <Label htmlFor="lf-noloyalty" weight="plus">Не действуют скидки Laflamme Club</Label>
            <Text size="small" className="text-ui-fg-subtle">Скидка уровня программы лояльности на этот товар не применяется.</Text>
          </div>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.before" })

export default ProductFlagsWidget
