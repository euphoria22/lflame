import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadVkAuth, saveVkAuth, vkConfigured, vkGroupId } from "../../../lib/vk/client"

/** Состояние подключения ВКонтакте (без ключей) — для раздела «Соцсети» */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const a = await loadVkAuth(true)
  res.json({
    connected: vkConfigured(),
    client_id: a.client_id ?? null,
    group: a.group ?? process.env.VK_GROUP_ID ?? null,
    group_id: vkGroupId(),
    user_id: a.user_id ?? null,
    scope: a.scope ?? null,
    connected_at: a.connected_at ?? null,
    by_env: Boolean(process.env.VK_ACCESS_TOKEN?.trim()),
  })
}

/** Отключить ВКонтакте: ключи удаляются (отложенные записи во ВКонтакте остаются) */
export async function DELETE(_req: MedusaRequest, res: MedusaResponse) {
  const a = await loadVkAuth(true)
  await saveVkAuth({ client_id: a.client_id, group: a.group, access_token: undefined, refresh_token: undefined, expires_at: undefined, device_id: undefined, user_id: undefined, pending: undefined, connected_at: undefined })
  res.json({ ok: true })
}
