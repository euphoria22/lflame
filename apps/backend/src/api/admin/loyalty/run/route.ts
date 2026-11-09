import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getLoyaltySettings, importOffline, importSinceLast, markImported, nightly } from "../../../../lib/loyalty/engine"

type State = { running: string | null; started_at: string | null; result: unknown; error: string | null }
const state: State = { running: null, started_at: null, result: null, error: null }
export const importState = () => ({ ...state })

/**
 * Кнопки панели: import — новые документы МС; reimport — все документы за период заново;
 * nightly — зачёт и пересчёт уровней сейчас. Работает в фоне, состояние — в списке участников.
 */
export async function POST(req: MedusaRequest<{ action?: string }>, res: MedusaResponse) {
  const action = req.body?.action
  if (!["import", "reimport", "nightly"].includes(action ?? "")) {
    res.status(400).json({ message: "Неизвестное действие" })
    return
  }
  if (state.running) {
    res.status(409).json({ message: "Уже выполняется, подождите" })
    return
  }
  Object.assign(state, { running: action, started_at: new Date().toISOString(), result: null, error: null })
  const c = req.scope
  ;(async () => {
    try {
      if (action === "nightly") state.result = await nightly(c)
      else if (action === "import") state.result = await importSinceLast(c)
      else {
        const s = await getLoyaltySettings()
        const started = new Date()
        state.result = await importOffline(c, new Date(Date.now() - s.period_days * 86_400_000))
        await markImported(started)
      }
    } catch (e) {
      state.error = (e as Error).message
    } finally {
      state.running = null
    }
  })()
  res.status(202).json({ ok: true })
}
