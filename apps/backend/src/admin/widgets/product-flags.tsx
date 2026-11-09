import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Container, Heading, Label, Switch, Text, toast } from "@medusajs/ui"
import { useState } from "react"

/** Флажки товара для сайта: предзаказ и исключение из программы лояльности. */
const ProductFlagsWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const [preorder, setPreorder] = useState(Boolean(product.metadata?.preorder))
  const [noLoyalty, setNoLoyalty] = useState(Boolean(product.metadata?.no_loyalty))
  const [busy, setBusy] = useState(false)

  const save = async (patch: { preorder?: boolean; no_loyalty?: boolean }) => {
    setBusy(true)
    try {
      const r = await fetch(`/admin/product-flags/${product.id}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      })
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "Не сохранилось")
      const d = (await r.json()) as { preorder: boolean; no_loyalty: boolean }
      setPreorder(d.preorder)
      setNoLoyalty(d.no_loyalty)
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
      <div className="flex flex-col gap-y-4 px-6 py-4">
        <div className="flex items-start gap-3">
          <Switch id="lf-preorder" checked={preorder} disabled={busy} onCheckedChange={(v) => save({ preorder: v })} />
          <div>
            <Label htmlFor="lf-preorder">Предзаказ</Label>
            <Text size="small" className="text-ui-fg-subtle">Все размеры можно заказать без остатка. На сайте — пометка «Предзаказ» и кнопка «Оформить предзаказ».</Text>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Switch id="lf-noloyalty" checked={noLoyalty} disabled={busy} onCheckedChange={(v) => save({ no_loyalty: v })} />
          <div>
            <Label htmlFor="lf-noloyalty">Не действуют скидки LAFLAMME</Label>
            <Text size="small" className="text-ui-fg-subtle">Скидка уровня программы лояльности на этот товар не применяется.</Text>
          </div>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.before" })

export default ProductFlagsWidget
