import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/** Email сотрудника, который сделал запрос в админке (для журналов операций) */
export async function staffEmail(req: AuthenticatedMedusaRequest): Promise<string> {
  const id = req.auth_context?.actor_id
  if (!id) return "админка"
  const u = await req.scope.resolve(Modules.USER).retrieveUser(id).catch(() => null)
  return u?.email ?? id
}
