/**
 * Пол (ТЗ, п. 2.2). Источник — поле «Для кого» в МоемСкладе, затем слова в названии.
 * По умолчанию «Мужское»: около 90% ассортимента мужское (решение от 08.11.2026).
 */
export type Gender = "men" | "women" | "unisex"

export const GENDER_NAMES: Record<Gender, string> = {
  men: "Мужское",
  women: "Женское",
  unisex: "Унисекс",
}

export function detectGender(name: string, moyskladValue?: string | null): Gender {
  const v = (moyskladValue || "").trim().toLowerCase()
  if (v.startsWith("муж")) return "men"
  if (v.startsWith("жен")) return "women"
  if (v.startsWith("уни")) return "unisex"

  const n = name.toLowerCase()
  if (n.includes("женск") || n.includes("(жен")) return "women"
  if (n.includes("унисекс")) return "unisex"
  return "men"
}
