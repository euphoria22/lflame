/**
 * Посадочные страницы по цвету: «Чёрные худи и свитшоты мужские» — /men/hudi-i-svitshoty/color/chernye.
 * Адрес — русское прилагательное латиницей (так ищут в Яндексе), окончания — под род и число категории.
 */
export type ColorLanding = { code: string; slug: string; plural: string; fem: string; phrase?: string }

export const COLOR_LANDINGS: ColorLanding[] = [
  { code: "black", slug: "chernye", plural: "Чёрные", fem: "Чёрная" },
  { code: "white", slug: "belye", plural: "Белые", fem: "Белая" },
  { code: "grey", slug: "serye", plural: "Серые", fem: "Серая" },
  { code: "blue", slug: "sinie", plural: "Синие", fem: "Синяя" },
  { code: "light-blue", slug: "golubye", plural: "Голубые", fem: "Голубая" },
  { code: "green", slug: "zelenye", plural: "Зелёные", fem: "Зелёная" },
  { code: "khaki", slug: "haki", plural: "", fem: "", phrase: "цвета хаки" },
  { code: "beige", slug: "bezhevye", plural: "Бежевые", fem: "Бежевая" },
  { code: "brown", slug: "korichnevye", plural: "Коричневые", fem: "Коричневая" },
  { code: "red", slug: "krasnye", plural: "Красные", fem: "Красная" },
  { code: "burgundy", slug: "bordovye", plural: "Бордовые", fem: "Бордовая" },
  { code: "pink", slug: "rozovye", plural: "Розовые", fem: "Розовая" },
  { code: "orange", slug: "oranzhevye", plural: "Оранжевые", fem: "Оранжевая" },
  { code: "yellow", slug: "zheltye", plural: "Жёлтые", fem: "Жёлтая" },
  { code: "purple", slug: "fioletovye", plural: "Фиолетовые", fem: "Фиолетовая" },
  { code: "multi", slug: "raznocvetnye", plural: "Разноцветные", fem: "Разноцветная" },
]

export const colorBySlug = (slug: string) => COLOR_LANDINGS.find((c) => c.slug === slug)
export const colorByCode = (code: string | null | undefined) => COLOR_LANDINGS.find((c) => c.code === code)

/** Категории в единственном числе женского рода («обувь») — остальные во множественном. */
const FEMININE = new Set(["obuv"])

/**
 * Заголовок: «Чёрные худи и свитшоты мужские», «Чёрная обувь мужская», «Худи и свитшоты цвета хаки мужские».
 * gender — «мужские»/«женские» (множественное число); для обуви — «мужская»/«женская».
 */
export function colorTitle(c: ColorLanding, categoryHandle: string, categoryName: string, genderPlural: string): string {
  const fem = FEMININE.has(categoryHandle)
  const gender = fem ? genderPlural.replace(/ие$/, "ая") : genderPlural
  // Названия групп из МоегоСклада бывают с заглавными внутри («Худи и Свитшоты») — в заголовке всё строчными
  const cat = categoryName.toLowerCase()
  if (c.phrase) return `${cat.charAt(0).toUpperCase()}${cat.slice(1)} ${c.phrase} ${gender}`
  return `${fem ? c.fem : c.plural} ${cat} ${gender}`
}

/** Короткая подпись для ссылок «по цвету» на странице категории: «Чёрные», «Цвета хаки». */
export function colorLinkLabel(c: ColorLanding, categoryHandle: string): string {
  if (c.phrase) return c.phrase.charAt(0).toUpperCase() + c.phrase.slice(1)
  return FEMININE.has(categoryHandle) ? c.fem : c.plural
}
