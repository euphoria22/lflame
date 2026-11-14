/**
 * Подразделы каталога: большие разделы делятся по первому слову названия товара («Футболка…», «Лонгслив…», «Пуховик…»).
 * Папки в МоёмСкладе не меняются; старые адреса разделов остаются, подраздел — /men/<раздел>/<подраздел>.
 * Товар, не подошедший ни под одно правило, остаётся только в разделе.
 */
export type Subtype = { slug: string; name: string }

type Rule = Subtype & { match: RegExp }

const RULES: Record<string, Rule[]> = {
  "futbolki-i-longslivy": [
    { slug: "longslivy", name: "Лонгсливы", match: /^лонгслив/ },
    { slug: "futbolki", name: "Футболки", match: /^(футболк|майк|топ(\s|$)|набор футбол)/ },
  ],
  "hudi-i-svitshoty": [
    { slug: "hudi", name: "Худи", match: /^худи/ },
    { slug: "svitshoty", name: "Свитшоты", match: /^свитшот/ },
  ],
  kurtki: [
    { slug: "puhoviki", name: "Пуховики и утеплённые куртки", match: /^(пуховик|парка|утепленн|зимн)/ },
    { slug: "kurtki-i-bombery", name: "Куртки и бомберы", match: /^(куртк|бомбер|ветровк|джинсовая|олимпийк|жилет|анорак|рубашка-куртк|овершот)/ },
  ],
  "golovnye-ubory": [
    { slug: "kepki", name: "Кепки", match: /^(бейсболк|кепк|панам|козыр)/ },
    { slug: "shapki", name: "Шапки", match: /^(шапк|балаклав|бини)/ },
  ],
  "rubashki-i-polo": [
    { slug: "polo", name: "Поло", match: /^поло/ },
    { slug: "rubashki", name: "Рубашки", match: /^(рубашк|овершот)/ },
  ],
}

/** Латинские буквы-двойники в начале русского слова («Cвитшот» с латинской C) и ё → е */
const LOOKALIKE: Record<string, string> = { a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", k: "к", m: "м", t: "т", h: "н", b: "в" }
export function normalizeTitle(title: string): string {
  const t = title.trim().toLowerCase().replace(/ё/g, "е")
  const first = t.split(/\s+/)[0] ?? ""
  // Первое слово с кириллицей — латинские двойники в нём заменяем
  return /[а-я]/.test(first) ? first.replace(/[a-z]/g, (ch) => LOOKALIKE[ch] ?? ch) + t.slice(first.length) : t
}

export function subtypeOf(category: string | null | undefined, title: string): Subtype | null {
  const rules = category ? RULES[category] : undefined
  if (!rules) return null
  const t = normalizeTitle(title)
  const hit = rules.find((r) => r.match.test(t))
  return hit ? { slug: hit.slug, name: hit.name } : null
}

/** Подразделы раздела в порядке показа */
export const subtypesOf = (category: string): Subtype[] => (RULES[category] ?? []).map(({ slug, name }) => ({ slug, name }))
