import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asNet, updateQueue } from "../../../../lib/telegram/channel"
import { vkPlanTick } from "../../../../lib/vk/plan"

type Body = { net?: string; add?: string[]; remove?: string[]; move?: { id: string; to: "up" | "down" | "top" }; clear?: boolean }
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])

/** Очередь постов: добавить товары в конец, убрать, поднять или опустить, очистить. */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const add = ids(req.body?.add)
  const remove = new Set(ids(req.body?.remove))
  const move = req.body?.move
  if (add.length > 500) { res.status(400).json({ message: "Слишком много товаров за раз" }); return }
  const q = await updateQueue(req.scope, (cur) => {
    let items = req.body?.clear ? [] : cur.items.filter((x) => !remove.has(x))
    items = [...items, ...add.filter((x) => !items.includes(x))]
    if (move && items.includes(move.id)) {
      const i = items.indexOf(move.id)
      const j = move.to === "top" ? 0 : move.to === "up" ? Math.max(0, i - 1) : Math.min(items.length - 1, i + 1)
      items.splice(i, 1)
      items.splice(j, 0, move.id)
    }
    return { ...cur, items }
  }, asNet(req.body?.net))
  // ВКонтакте: добавленные товары сразу уходят в отложку на свободные слоты
  if (asNet(req.body?.net) === "vk" && add.length) void vkPlanTick(req.scope, req.scope.resolve(ContainerRegistrationKeys.LOGGER)).catch(() => null)
  res.json({ items: q.items })
}
