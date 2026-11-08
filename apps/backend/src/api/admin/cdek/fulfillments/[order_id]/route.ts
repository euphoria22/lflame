import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** Отправки СДЭК заказа для блока «СДЭК» в карточке заказа. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "fulfillments.id", "fulfillments.provider_id", "fulfillments.data", "fulfillments.created_at", "fulfillments.shipped_at", "fulfillments.delivered_at", "fulfillments.canceled_at"],
    filters: { id: req.params.order_id },
  })
  const order = data[0] as { fulfillments?: { provider_id: string }[] } | undefined
  res.json({ fulfillments: (order?.fulfillments ?? []).filter((f) => f.provider_id === "cdek_cdek") })
}
