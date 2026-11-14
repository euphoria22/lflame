import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEFAULT_CONFIG, ZONES } from "../../../lib/sort/config"
import { activeConfig, allRules, configVersions, eventSums, sortState } from "../../../lib/sort/engine"
import { activeProfile } from "../../../lib/sort/score"
import { seasonState } from "../../../lib/sort/season"

/** Всё для страницы «Сортировка»: настройки, версии, состояние пересчёта, правила, сезон по зонам */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const now = new Date()
  const [{ config, version }, versions, state, rules, events] = await Promise.all([
    activeConfig(req.scope), configVersions(req.scope), sortState(req.scope), allRules(req.scope), eventSums(req.scope, now),
  ])
  const seasons = Object.fromEntries(ZONES.map((z) => [z, seasonState(now, z, config)]))
  res.json({
    config, version, versions, defaults: DEFAULT_CONFIG, state, rules, seasons,
    stats_days: events.days, profile: activeProfile(config, seasonState(now, "central", config), events.days),
    // Пересчёт не проходил больше 26 часов — сайт работает на старых баллах
    stale: !state.last_ok_at || now.getTime() - Date.parse(state.last_ok_at) > 26 * 3_600_000,
  })
}
