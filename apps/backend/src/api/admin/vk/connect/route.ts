import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { vkConnectUrl } from "../../../../lib/vk/client"

/**
 * «Подключить ВКонтакте»: ?client_id=<ID приложения>&group=<сообщество> → страница разрешения ВКонтакте.
 * Адрес возврата https://<админка>/admin/vk/callback должен быть в «Доверенных Redirect URL» приложения.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const clientId = String(req.query.client_id ?? "").trim()
  const group = String(req.query.group ?? "").trim()
  if (!/^\d{3,12}$/.test(clientId)) { res.status(400).send("Укажите ID приложения ВКонтакте (число)"); return }
  if (!group) { res.status(400).send("Укажите сообщество, например laflammeru"); return }
  const host = req.get("x-forwarded-host") ?? req.get("host")
  const proto = req.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  res.redirect(await vkConnectUrl(clientId, group, `${proto}://${host}/admin/vk/callback`))
}
