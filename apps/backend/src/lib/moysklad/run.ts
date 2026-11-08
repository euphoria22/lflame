import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../../modules/moysklad"
import MoyskladModuleService from "../../modules/moysklad/service"
import { fetchFreeStock, loadSyncContext } from "./context"
import { CatalogProblem, SyncCatalogInput, syncCatalog } from "./sync-catalog"
import { syncStockLevels } from "./sync-stock"

export type Trigger = "schedule" | "manual" | "webhook" | "script"

const LOCK_KEY = "moysklad-sync"
const MAX_STORED_PROBLEMS = 2000

export type RunResult = { id: string | null; status: string; skipped?: boolean; stats?: unknown; error?: string }

/**
 * Запуск синхронизации с записью в журнал (ТЗ, п. 3.1, 3.6).
 * Одновременно идёт только одна синхронизация: вторая пропускается.
 */
export async function runMoyskladSync(
  container: MedusaContainer,
  kind: "catalog" | "stock",
  trigger: Trigger,
  input: SyncCatalogInput = { mode: "incremental" }
): Promise<RunResult> {
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const locking = container.resolve(Modules.LOCKING)

  try {
    return await locking.execute(LOCK_KEY, () => execute(container, ms, kind, trigger, input), { timeout: 1 })
  } catch (e) {
    const msg = (e as Error).message ?? ""
    if (/lock|timed out|timeout/i.test(msg)) {
      logger.info(`МойСклад: синхронизация уже идёт, запуск «${kind}» пропущен`)
      return { id: null, status: "skipped", skipped: true }
    }
    throw e
  }
}

async function execute(
  container: MedusaContainer,
  ms: MoyskladModuleService,
  kind: "catalog" | "stock",
  trigger: Trigger,
  input: SyncCatalogInput
): Promise<RunResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Запуски, прерванные перезапуском сервера: под блокировкой других активных запусков быть не может
  const stale = await ms.listMoyskladSyncRuns({ status: "running" }, { select: ["id"] })
  if (stale.length) {
    await ms.updateMoyskladSyncRuns(
      stale.map((r) => ({ id: r.id, status: "failed" as const, finished_at: new Date(), error: "Прервано (перезапуск сервера)" }))
    )
  }

  if (kind === "catalog" && input.mode === "incremental" && !input.since) {
    const [last] = await ms.listMoyskladSyncRuns(
      { kind: "catalog", status: ["success", "partial"] },
      { order: { started_at: "DESC" }, take: 1 }
    )
    // Запас 5 минут: часы МС и сервера могут расходиться
    input = { ...input, since: last ? new Date(new Date(last.started_at).getTime() - 5 * 60 * 1000) : undefined }
  }

  const run = await ms.createMoyskladSyncRuns({
    kind,
    mode: kind === "stock" ? "full" : input.mode,
    trigger,
    status: "running",
    started_at: new Date(),
  })

  const problems: CatalogProblem[] = []
  try {
    const ctx = await loadSyncContext(container)
    let stats: Record<string, unknown>
    if (kind === "stock") {
      stats = { ...(await syncStockLevels(ctx, await fetchFreeStock(ctx))) }
    } else {
      stats = { ...(await syncCatalog(ctx, input, (p) => problems.push(p))) }
    }
    const status = (stats.errors as number) > 0 ? "partial" : "success"
    await ms.updateMoyskladSyncRuns({
      id: run.id,
      status,
      finished_at: new Date(),
      stats,
      problems: kind === "catalog" ? { total: problems.length, items: problems.slice(0, MAX_STORED_PROBLEMS) } : null,
    })
    logger.info(`МойСклад: синхронизация «${kind}» завершена: ${JSON.stringify(stats)}`)
    return { id: run.id, status, stats }
  } catch (e) {
    const error = (e as Error).message
    logger.error(`МойСклад: синхронизация «${kind}» не удалась: ${error}`)
    await ms.updateMoyskladSyncRuns({ id: run.id, status: "failed", finished_at: new Date(), error })
    return { id: run.id, status: "failed", error }
  }
}
