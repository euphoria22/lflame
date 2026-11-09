import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Size = { size: string; waiting: number; notified: number }

/** «Ждут поступления»: подписки покупателей на закончившиеся размеры этого товара. */
const ProductRestockWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const [sizes, setSizes] = useState<Size[] | null>(null)
  useEffect(() => {
    fetch(`/admin/restock/${product.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { sizes?: Size[] }) => setSizes(d.sizes ?? []))
      .catch(() => setSizes([]))
  }, [product.id])
  if (!sizes?.length) return null
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Ждут поступления</Heading>
        <Text size="small" className="text-ui-fg-subtle">Покупатели нажали «Сообщить о поступлении». Письмо уйдёт само, когда размер появится в МоёмСкладе.</Text>
      </div>
      <div className="flex flex-col gap-2 px-6 py-4">
        {sizes.map((s) => (
          <div key={s.size} className="flex justify-between text-sm">
            <span>Размер {s.size}</span>
            <span>{s.waiting ? `ждут: ${s.waiting}` : ""}{s.waiting && s.notified ? " · " : ""}{s.notified ? <span className="text-ui-fg-subtle">уведомлены: {s.notified}</span> : null}</span>
          </div>
        ))}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })

export default ProductRestockWidget
