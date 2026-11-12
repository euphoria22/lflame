import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderShipmentWorkflow } from "@medusajs/medusa/core-flows"
import { cleanLabels } from "../../../../lib/delivery/shipment-labels"

type F = {
  id: string; provider_id?: string | null; shipped_at: string | null; canceled_at: string | null; delivered_at: string | null
  data?: Record<string, unknown> | null
  labels?: { tracking_number?: string | null; tracking_url?: string | null }[] | null
  items?: { line_item_id?: string | null; quantity: unknown }[] | null
}

const PROVIDER: Record<string, string> = { cdek: "СДЭК", pochta: "Почта России", manual: "Самовывоз / курьер" }

async function load(req: MedusaRequest): Promise<F[]> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "fulfillments.id", "fulfillments.provider_id", "fulfillments.shipped_at", "fulfillments.canceled_at", "fulfillments.delivered_at",
      "fulfillments.data", "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url", "fulfillments.items.line_item_id", "fulfillments.items.quantity"],
    filters: { id: req.params.order_id },
  })
  return ((data[0] as { fulfillments?: F[] } | undefined)?.fulfillments ?? []).filter((f) => !f.canceled_at)
}

/** Сборки заказа: способ доставки, трек-номер (у СДЭК — из их заказа), отправлена ли. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const list = await load(req)
  res.json({
    fulfillments: list.map((f) => {
      const provider = String(f.provider_id ?? "").split("_")[0]
      const track = f.labels?.find((l) => l.tracking_number)?.tracking_number ?? (f.data?.cdek_number as string | undefined) ?? null
      return { id: f.id, provider: PROVIDER[provider] ?? (provider || "—"), tracking_number: track, shipped_at: f.shipped_at, delivered_at: f.delivered_at }
    }),
  })
}

/**
 * «Отметить отправленным» без формы Medusa (она требует ссылку на этикетку и падает на пустых полях).
 * Ссылка на отслеживание строится по трек-номеру сама; покупателю уходит письмо с треком.
 */
export async function POST(req: MedusaRequest<{ fulfillment_id?: string; tracking_number?: string }>, res: MedusaResponse) {
  const { fulfillment_id, tracking_number } = req.body ?? {}
  const f = (await load(req)).find((x) => x.id === fulfillment_id)
  if (!f) {
    res.status(404).json({ message: "Сборка не найдена" })
    return
  }
  if (f.shipped_at) {
    res.status(400).json({ message: "Уже отмечено отправленным" })
    return
  }
  const num = String(tracking_number ?? "").trim().slice(0, 60)
  await createOrderShipmentWorkflow(req.scope).run({
    input: {
      order_id: req.params.order_id,
      fulfillment_id: f.id,
      items: (f.items ?? []).filter((i) => i.line_item_id).map((i) => ({ id: i.line_item_id as string, quantity: Number(i.quantity) })),
      labels: cleanLabels([{ tracking_number: num }]),
    },
  })
  res.json({ ok: true })
}
