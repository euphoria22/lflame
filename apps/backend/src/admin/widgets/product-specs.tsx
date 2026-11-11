import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { EllipsisHorizontal, PencilSquare } from "@medusajs/icons"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Drawer, DropdownMenu, Heading, IconButton, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useState } from "react"

/** «Состав: 100% хлопок» → подпись и значение; строка без подписи — как на сайте: с процентами «Состав», иначе «Особенности». */
const rows = (specs: string) =>
  specs.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^([^:]{1,40}):\s*(.+)$/.exec(l)
    return m ? { key: m[1].trim(), value: m[2].trim() } : { key: /\d\s*%/.test(l) ? "Состав" : "Особенности", value: l }
  })

/** Характеристики товара на сайте: Состав, Крой, Детали, Уход… Бренд, категория, цвет и артикул добавляются на сайте сами. */
const ProductSpecsWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const initial = typeof product.metadata?.old_site_specs === "string" ? product.metadata.old_site_specs : ""
  const [specs, setSpecs] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const r = await fetch(`/admin/product-flags/${product.id}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ specs: draft }),
      })
      const d = (await r.json().catch(() => ({}))) as { specs?: string | null; message?: string }
      if (!r.ok) throw new Error(d.message ?? "Не сохранилось")
      setSpecs(d.specs ?? "")
      setOpen(false)
      toast.success("Сохранено — на сайте обновится в течение минуты")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const list = rows(specs)
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Характеристики на сайте</Heading>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton size="small" variant="transparent"><EllipsisHorizontal /></IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item className="gap-x-2" onClick={() => { setDraft(specs); setOpen(true) }}>
              <PencilSquare className="text-ui-fg-subtle" />Редактировать
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      {list.length ? list.map((r, i) => (
        <div key={i} className="grid grid-cols-2 items-start px-6 py-4 text-ui-fg-subtle">
          <Text size="small" weight="plus" leading="compact">{r.key}</Text>
          <Text size="small" leading="compact" className="whitespace-pre-wrap">{r.value}</Text>
        </div>
      )) : (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">Не заполнено. На сайте будут только бренд, категория, цвет, пол и артикул.</Text>
        </div>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header><Drawer.Title>Характеристики на сайте</Drawer.Title></Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-3">
            <Label htmlFor="lf-specs">Каждая строка — «Название: значение»</Label>
            <Textarea id="lf-specs" rows={10} value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={"Состав: 100% хлопок\nКрой: Oversize\nДетали: капюшон, два кармана\nУход: стирка при 30°"} />
            <Text size="small" className="text-ui-fg-subtle">
              Бренд, категория, цвет, «для кого» и артикул на сайте добавляются сами — их сюда писать не нужно.
            </Text>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild><Button variant="secondary" size="small">Отмена</Button></Drawer.Close>
            <Button size="small" isLoading={busy} onClick={save}>Сохранить</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.after" })

export default ProductSpecsWidget
