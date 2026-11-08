/**
 * Цвет товара (ТЗ, п. 2.2): нормализованный код для фильтра + русское название.
 * Источник: доп. поле «Цвет» в МоемСкладе; если пусто — последнее цветовое слово
 * в названии ("... Logo Black Beauty" -> black).
 */
export type ColorCode =
  | "black" | "white" | "grey" | "blue" | "light-blue" | "green" | "khaki"
  | "beige" | "brown" | "red" | "burgundy" | "pink" | "orange" | "yellow"
  | "purple" | "silver" | "gold" | "multi"

export const COLOR_NAMES: Record<ColorCode, string> = {
  black: "Чёрный",
  white: "Белый",
  grey: "Серый",
  blue: "Синий",
  "light-blue": "Голубой",
  green: "Зелёный",
  khaki: "Хаки",
  beige: "Бежевый",
  brown: "Коричневый",
  red: "Красный",
  burgundy: "Бордовый",
  pink: "Розовый",
  orange: "Оранжевый",
  yellow: "Жёлтый",
  purple: "Фиолетовый",
  silver: "Серебряный",
  gold: "Золотой",
  multi: "Мульти",
}

/** Значения поля «Цвет» в МоемСкладе. */
const RU: Record<string, ColorCode> = {
  "черный": "black", "чёрный": "black", "белый": "white", "серый": "grey",
  "синий": "blue", "голубой": "light-blue", "зеленый": "green", "зелёный": "green",
  "хаки": "khaki", "бежевый": "beige", "коричневый": "brown", "красный": "red",
  "бордовый": "burgundy", "розовый": "pink", "оранжевый": "orange",
  "желтый": "yellow", "жёлтый": "yellow", "фиолетовый": "purple",
  "серебряный": "silver", "золотой": "gold", "мульти": "multi", "разноцветный": "multi",
}

/** Однозначные цветовые слова: проверяются первыми. */
const PRIMARY: Record<string, ColorCode> = {
  black: "black", noir: "black", nero: "black",
  white: "white", "off-white": "white", ivory: "white", bone: "white", chalk: "white", optic: "white",
  grey: "grey", gray: "grey", anthracite: "grey", charcoal: "grey",
  blue: "blue", navy: "blue", indigo: "blue", denim: "blue", sapphire: "blue", peacoat: "blue",
  green: "green", olive: "green", pine: "green", moss: "green", mint: "green", sage: "green", pistachio: "green", pistacho: "green", lime: "green",
  khaki: "khaki",
  beige: "beige", sand: "beige", tan: "beige", taupe: "beige", ecru: "beige", cream: "beige", oat: "beige", camel: "beige", caramel: "beige", stone: "beige",
  brown: "brown", chocolate: "brown", walnut: "brown", mink: "brown", sable: "brown",
  red: "red", rouge: "red",
  burgundy: "burgundy", bordeaux: "burgundy", maroon: "burgundy", cabernet: "burgundy", plum: "burgundy",
  pink: "pink", rose: "pink", coral: "pink",
  orange: "orange",
  yellow: "yellow", gold: "gold",
  purple: "purple", violet: "purple", lavande: "purple", lavender: "purple",
  silver: "silver",
  multi: "multi", multicolor: "multi", aop: "multi",
}

/** Неоднозначные слова: только если однозначного цвета в названии нет. */
const SECONDARY: Record<string, ColorCode> = {
  heather: "grey", melange: "grey", htr: "grey", ash: "grey", iron: "grey", slate: "grey", fog: "grey", shadow: "grey",
  eclipse: "blue", sky: "light-blue", lagoon: "light-blue", ice: "light-blue",
  tofu: "white", natural: "beige", dune: "beige", toast: "beige",
  berry: "pink", petal: "pink",
  burro: "brown", buro: "brown", java: "brown", amphora: "brown", mulch: "brown", sycamore: "brown",
  honey: "yellow", golden: "yellow", limelight: "green",
  beluga: "grey", pavement: "grey", crockery: "white", calico: "beige", panda: "multi",
}

export function colorFromMoysklad(value: string | null | undefined): ColorCode | null {
  if (!value) {
    return null
  }
  return RU[value.trim().toLowerCase()] ?? null
}

/**
 * Цвет по названию. Берётся часть до "/" между словами ("Black / White" -> Black,
 * но "30/1 Jersey" не разделяется),
 * скобки отбрасываются, поиск идёт с конца названия.
 */
export function colorFromName(name: string): ColorCode | null {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s\/\s|(?<=[A-Za-z])\/(?=[A-Za-z])/)[0]
    .toLowerCase()
    .split(/[^a-z-]+/)
    .filter(Boolean)
    .reverse()

  for (const dict of [PRIMARY, SECONDARY]) {
    for (const w of words) {
      if (dict[w]) {
        return dict[w]
      }
    }
  }
  return null
}

export function detectColor(name: string, moyskladValue?: string | null): ColorCode | null {
  return colorFromMoysklad(moyskladValue) ?? colorFromName(name)
}
