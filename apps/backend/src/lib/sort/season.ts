import { MatrixRow, Season, SEASONS, SortConfig, Warmth, Zone } from "./config"

/**
 * Сезонность (ТЗ, раздел 4): Z = clamp(W[категория][сезон] × C, 0.1, 1).
 * Календарь сдвинут на 3–5 недель раньше погоды; по климатическим зонам границы смещаются;
 * на границе сезонов веса смешиваются blend_days дней.
 */
const DAY = 86_400_000
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d)
const COLD: Season[] = ["autumn", "winter"]

/** Начала сезонов вокруг даты (прошлый, этот и следующий год) с учётом сдвига зоны, по возрастанию */
function starts(now: Date, zone: Zone, cfg: SortConfig): { season: Season; at: number }[] {
  const y = now.getUTCFullYear()
  const out: { season: Season; at: number }[] = []
  for (const year of [y - 1, y, y + 1]) {
    for (const s of SEASONS) {
      const shift = COLD.includes(s) ? cfg.zones[zone].cold_season : cfg.zones[zone].warm_season
      out.push({ season: s, at: utc(year, cfg.calendar[s][0], cfg.calendar[s][1]) + shift * DAY })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

export type SeasonState = {
  season: Season
  /** Прошлый сезон и доля нового (0…1): пока идёт плавный переход */
  prev: Season
  t: number
  /** Дней от начала сезона и до его конца */
  since: number
  left: number
  /** Год начала сезона (для «текущей коллекции») */
  year: number
}

export function seasonState(now: Date, zone: Zone, cfg: SortConfig): SeasonState {
  const list = starts(now, zone, cfg)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  let i = 0
  for (let k = 0; k < list.length; k++) if (list[k].at <= today) i = k
  const cur = list[i], next = list[i + 1] ?? { at: cur.at + 120 * DAY }
  const since = Math.round((today - cur.at) / DAY)
  return {
    season: cur.season,
    prev: list[i - 1]?.season ?? cur.season,
    t: cfg.blend_days > 0 ? Math.min(1, since / cfg.blend_days) : 1,
    since,
    left: Math.round((next.at - today) / DAY),
    year: new Date(cur.at).getUTCFullYear(),
  }
}

/** Вес строки матрицы на дату: смесь прошлого и нового сезона */
export const blend = (row: Record<Season, number>, st: SeasonState) => (1 - st.t) * row[st.prev] + st.t * row[st.season]

/** Коллекция карточки: «FW26», «SS 25», «AW26» → тип и год; иначе вне сезона */
export function parseCollection(raw: string | null | undefined): { type: "FW" | "SS"; year: number } | null {
  const m = String(raw ?? "").toUpperCase().match(/\b(FW|AW|SS)\s?-?['’]?(\d{2}|\d{4})\b/)
  if (!m) return null
  const y = Number(m[2])
  return { type: m[1] === "SS" ? "SS" : "FW", year: y < 100 ? 2000 + y : y }
}

/** Коэффициент коллекции C: текущая 1.0, вне сезона 0.9, прошлая того же типа 0.85, противоположного типа 0.6 */
export function collectionFactor(raw: string | null | undefined, st: SeasonState, cfg: SortConfig): number {
  const c = parseCollection(raw)
  if (!c) return cfg.collection.none
  const type = COLD.includes(st.season) ? "FW" : "SS"
  if (c.type !== type) return cfg.collection.opposite
  // FW считается по году осени: зима 2026/27 — это FW26 (зима в календаре начинается в ноябре того же года)
  const year = st.season === "winter" && cfg.calendar.winter[0] <= 6 ? st.year - 1 : st.year
  return c.year >= year ? cfg.collection.current : cfg.collection.previous
}

export function seasonZ(input: { row: MatrixRow; warmth: Warmth | null; collection: string | null }, st: SeasonState, cfg: SortConfig): { z: number; w: number; c: number } {
  // Признак утеплённости важнее категории
  const w = blend(input.warmth ? cfg.warmth[input.warmth] : cfg.matrix[input.row], st)
  const c = collectionFactor(input.collection, st, cfg)
  return { z: Math.min(1, Math.max(0.1, w * c)), w, c }
}

/** Строка матрицы по разделу сайта и названию: «Куртки» делятся на пуховики и лёгкие, «Обувь» — на зимнюю, кроссовки и сланцы */
export function matrixRow(category: string | null, title: string): MatrixRow {
  const t = title.toLowerCase().replace(/ё/g, "е")
  const has = (re: RegExp) => re.test(t)
  switch (category) {
    case "kurtki":
      if (has(/жилет/)) return "vests"
      return has(/пуховик|парка|утепл|зимн|аляск|дубленк|шуб/) ? "puffers" : "light_jackets"
    case "svitery-i-kardigany": return has(/жилет/) ? "vests" : "knitwear"
    case "hudi-i-svitshoty": return "hoodies"
    case "futbolki-i-longslivy": return has(/лонгслив/) ? "longsleeves" : "tees"
    case "rubashki-i-polo": return has(/поло/) ? "tees" : "shirts"
    case "dzhinsy": case "bryuki": return "pants"
    case "shorty": return "shorts"
    case "golovnye-ubory": return has(/кепк|бейсболк|панам|козыр|бандан/) ? "caps" : "winter_hats"
    case "obuv":
      if (has(/сланц|сандал|шлепанц|шлепк|слайд/)) return "sandals"
      return has(/ботин|сапог|угг|зимн|утепл/) ? "winter_shoes" : "sneakers"
    default:
      if (has(/шарф|перчат|варежк/)) return "winter_hats"
      return "accessories"
  }
}
