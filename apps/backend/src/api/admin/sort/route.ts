import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadCatalogItems } from "../../../lib/catalog/store-catalog"
import { DEFAULT_CONFIG, ZONES } from "../../../lib/sort/config"
import { activeConfig, allRules, configVersions, eventSums, sortState } from "../../../lib/sort/engine"
import { activeProfile } from "../../../lib/sort/score"
import { seasonState } from "../../../lib/sort/season"

/** Всё для страницы «Сортировка»: настройки, версии, состояние пересчёта, правила, сезон по зонам */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const now = new Date()
  const [{ config, version }, versions, state, rules, events, items] = await Promise.all([
    activeConfig(req.scope), configVersions(req.scope), sortState(req.scope), allRules(req.scope), eventSums(req.scope, now), loadCatalogItems(req.scope),
  ])
  // Справочники для выбора листинга и целей правил
  const uniq = <T extends { handle: string; name: string }>(list: (T | null)[]) => [...new Map(list.filter((x): x is T => Boolean(x)).map((x) => [x.handle, { handle: x.handle, name: x.name }])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const titles = Object.fromEntries(items.map((i) => [i.id, i.title]))
  const seasons = Object.fromEntries(ZONES.map((z) => [z, seasonState(now, z, config)]))
  res.json({
    config, version, versions, defaults: DEFAULT_CONFIG, state, rules, seasons,
    brands: uniq(items.map((i) => i.brand)), categories: uniq(items.map((i) => i.category)), titles,
    stats_days: events.days, profile: activeProfile(config, seasonState(now, "central", config), events.days),
    // Пересчёт не проходил больше 26 часов — сайт работает на старых баллах
    stale: !state.last_ok_at || now.getTime() - Date.parse(state.last_ok_at) > 26 * 3_600_000,
  })
}
