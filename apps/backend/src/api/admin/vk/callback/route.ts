import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { vkFinishConnect } from "../../../../lib/vk/client"

/** Возврат со страницы разрешения ВКонтакте: получаем ключи и возвращаемся в «Соцсети» */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = req.query as Record<string, string | undefined>
  if (q.error) { res.redirect(`/app/telegram?vk_error=${encodeURIComponent(q.error_description ?? q.error)}`); return }
  try {
    await vkFinishConnect(String(q.code ?? ""), String(q.state ?? ""), String(q.device_id ?? ""))
    res.redirect("/app/telegram?vk=connected")
  } catch (e) {
    res.redirect(`/app/telegram?vk_error=${encodeURIComponent((e as Error).message)}`)
  }
}
